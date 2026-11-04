begin;

-- Public invite tokens prove access to a Cell Group registration form, not
-- ownership of a Member profile. Any duplicate candidate is retained for
-- staff review; public requests never update or link existing Members.
alter table public.member_registration_reviews
  drop constraint if exists member_registration_reviews_matched_profile_count_check;
alter table public.member_registration_reviews
  add constraint member_registration_reviews_matched_profile_count_check check (matched_profile_count > 0);

create or replace function public.submit_cell_group_member_registration(
  p_request_id uuid, p_invite_token text, p_first_name text, p_last_name text,
  p_nickname text, p_gender text, p_birthday date, p_mobile text, p_email text,
  p_address text, p_match_decision text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_cell_group_id uuid;
  clean_first text := regexp_replace(btrim(coalesce(p_first_name,'')), '[[:space:]]+', ' ', 'g');
  clean_last text := regexp_replace(btrim(coalesce(p_last_name,'')), '[[:space:]]+', ' ', 'g');
  candidate_count integer;
  likely_count integer;
  shared_count integer;
  candidate_json jsonb;
begin
  if p_request_id is null then raise exception 'A registration request identifier is required' using errcode='22023'; end if;
  if public.normalize_member_registration_name(clean_first) = '' or public.normalize_member_registration_name(clean_last) = '' then
    raise exception 'First name and last name are required' using errcode='22023';
  end if;
  if p_gender not in ('Male','Female') then raise exception 'A valid gender is required' using errcode='22023'; end if;
  if p_birthday is not null and p_birthday >= current_date then raise exception 'Birthday must be earlier than today' using errcode='22023'; end if;
  if p_match_decision is not null and p_match_decision not in ('confirm_existing','create_new') then
    raise exception 'Invalid profile matching decision' using errcode='22023';
  end if;
  select invite.cell_group_id into target_cell_group_id from public.cell_group_invites invite
    where invite.token=p_invite_token and invite.is_active=true limit 1;
  if target_cell_group_id is null then raise exception 'This invitation is invalid or inactive' using errcode='P0002'; end if;

  perform pg_advisory_xact_lock(731004220118);
  select count(*), count(*) filter (where public.normalize_member_registration_name(m.last_name)=public.normalize_member_registration_name(clean_last)
      and public.member_first_names_similar(m.first_name,clean_first)),
    count(*) filter (where not (public.normalize_member_registration_name(m.last_name)=public.normalize_member_registration_name(clean_last)
      and public.member_first_names_similar(m.first_name,clean_first))),
    coalesce(jsonb_agg(jsonb_build_object('id',m.id,'first_name',m.first_name,'last_name',m.last_name,
      'mobile',m.mobile,'match_kind',case when public.normalize_member_registration_name(m.last_name)=public.normalize_member_registration_name(clean_last)
        and public.member_first_names_similar(m.first_name,clean_first) then 'likely_same_person' else 'possible_shared_contact' end)), '[]'::jsonb)
  into candidate_count, likely_count, shared_count, candidate_json
  from public.members m where
    (public.normalize_member_registration_name(m.last_name)=public.normalize_member_registration_name(clean_last)
      and public.member_first_names_similar(m.first_name,clean_first))
    or (public.normalize_member_mobile(m.mobile)<>'' and public.normalize_member_mobile(m.mobile)=public.normalize_member_mobile(p_mobile));

  if candidate_count > 0 then
    insert into public.member_registration_reviews(request_id,cell_group_id,normalized_first_name,normalized_last_name,
      submitted_profile,matched_profile_count)
    values (p_request_id,target_cell_group_id,public.normalize_member_registration_name(clean_first),
      public.normalize_member_registration_name(clean_last),
      jsonb_build_object('first_name',clean_first,'last_name',clean_last,'nickname',nullif(btrim(coalesce(p_nickname,'')),''),
        'gender',p_gender,'birthday',p_birthday,'mobile',nullif(btrim(coalesce(p_mobile,'')),''),
        'email',nullif(btrim(coalesce(p_email,'')),''),'address',nullif(btrim(coalesce(p_address,'')),''),
        'duplicate_candidates',candidate_json), greatest(candidate_count,1))
    on conflict(request_id) do nothing;
    return jsonb_build_object('status','needs_review');
  end if;

  if p_match_decision='confirm_existing' then
    raise exception 'No matching profile is available. Submit the registration for staff review.' using errcode='P0002';
  end if;
  perform set_config('ggccc.member_invite_registration','on',true);
  insert into public.members(first_name,last_name,nickname,gender,birthday,mobile,email,address,cell_group_id,membership_status,remarks)
  values(clean_first,clean_last,coalesce(nullif(btrim(coalesce(p_nickname,'')),''),''),p_gender,p_birthday,
    coalesce(nullif(btrim(coalesce(p_mobile,'')),''),''),coalesce(nullif(btrim(coalesce(p_email,'')),''),''),
    coalesce(nullif(btrim(coalesce(p_address,'')),''),''),target_cell_group_id,'Visitor','');
  return jsonb_build_object('status','created');
end;
$$;
revoke all on function public.submit_cell_group_member_registration(uuid,text,text,text,text,text,date,text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_cell_group_member_registration(uuid,text,text,text,text,text,date,text,text,text,text) to anon, authenticated;

-- Keep table reads under the existing RLS policy. Ordinary authenticated
-- clients receive no table UPDATE privilege; status changes go through this
-- narrow function, which derives identity from auth.uid().
revoke update on public.member_registration_reviews from public, anon, authenticated;
grant select on public.member_registration_reviews to authenticated;
drop policy if exists "Permitted member registration review update" on public.member_registration_reviews;
drop policy if exists "Role scoped registration review update" on public.member_registration_reviews;

create or replace function public.set_member_registration_review_status(p_review_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  review_group_id uuid;
begin
  if actor_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_status not in ('resolved','dismissed') then raise exception 'Invalid review status' using errcode='22023'; end if;
  select r.cell_group_id into review_group_id from public.member_registration_reviews r
    where r.id=p_review_id and r.status='pending' for update;
  if review_group_id is null then raise exception 'Pending review not found' using errcode='P0002'; end if;
  if not (
    public.has_permission('admin.users')
    or (
      public.has_permission('members.update')
      and not exists (
        select 1 from public.users u join public.user_roles ur on ur.user_id=u.id
        join public.roles r on r.id=ur.role_id
        where u.id=actor_id and u.is_active and r.code='cell_leader'
      )
    )
    or exists (
      select 1 from public.users u join public.user_roles ur on ur.user_id=u.id
      join public.roles r on r.id=ur.role_id
      join public.cell_groups cg on cg.leader_member_id=u.member_id
      where u.id=actor_id and u.is_active and r.code='cell_leader' and cg.id=review_group_id
    )
  ) then raise exception 'Review access denied' using errcode='42501'; end if;
  update public.member_registration_reviews
    set status=p_status, reviewed_by=actor_id, reviewed_at=now()
    where id=p_review_id and status='pending';
  if not found then raise exception 'Pending review not found' using errcode='P0002'; end if;
  return jsonb_build_object('verified',true,'status',p_status);
end;
$$;
revoke all on function public.set_member_registration_review_status(uuid,text) from public, anon;
grant execute on function public.set_member_registration_review_status(uuid,text) to authenticated;

-- Profile/role edits cannot change activation state. The dedicated activation
-- operation is the only path that changes the DB status and synchronizes Auth.
create or replace function public.admin_user_upsert(
  p_auth_user_id uuid, p_caller_user_id uuid, p_username text,
  p_display_name text, p_member_id uuid, p_is_active boolean,
  p_role_codes text[]
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  role_count integer;
  effective_is_active boolean;
begin
  if not exists (
    select 1 from public.users u join public.user_roles ur on ur.user_id=u.id
    join public.role_permissions rp on rp.role_id=ur.role_id
    join public.permissions p on p.id=rp.permission_id
    where u.id=p_caller_user_id and u.is_active and p.code='admin.users'
  ) then raise exception 'admin.users permission required' using errcode='42501'; end if;
  if p_username !~ '^[A-Za-z0-9][A-Za-z0-9_.-]{2,39}$' then
    raise exception 'Invalid username' using errcode='22023';
  end if;
  if p_display_name is null or btrim(p_display_name)='' or char_length(btrim(p_display_name))>120 then
    raise exception 'Invalid display name' using errcode='22023';
  end if;
  if p_member_id is not null and not exists(select 1 from public.members where id=p_member_id) then
    raise exception 'Member not found' using errcode='P0002';
  end if;
  if p_member_id is not null and exists(select 1 from public.users where member_id=p_member_id and id<>p_auth_user_id) then
    raise exception 'Member is already linked to another CMS account' using errcode='23505';
  end if;
  if p_role_codes is null or cardinality(p_role_codes)=0 then raise exception 'At least one role is required' using errcode='22023'; end if;
  select count(*) into role_count from public.roles where code=any(p_role_codes);
  if role_count<>cardinality(p_role_codes) then raise exception 'One or more roles are invalid' using errcode='22023'; end if;
  if 'administrator'=any(p_role_codes) and not exists(select 1 from public.users where id=p_auth_user_id) then
    raise exception 'Administrator role assignment requires a separately approved process' using errcode='42501';
  end if;
  if 'administrator'=any(p_role_codes) and not exists(
    select 1 from public.users u join public.user_roles ur on ur.user_id=u.id
    join public.roles r on r.id=ur.role_id where u.id=p_caller_user_id and r.code='administrator'
  ) then raise exception 'Only an existing Administrator may assign Administrator role' using errcode='42501'; end if;

  perform pg_advisory_xact_lock(hashtext('ggccc-active-administrator'));
  select coalesce(u.is_active,p_is_active) into effective_is_active from public.users u where u.id=p_auth_user_id;
  if not found then effective_is_active := p_is_active; end if;
  if exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=p_auth_user_id and r.code='administrator')
    and (not effective_is_active or not ('administrator'=any(p_role_codes)))
    and (select count(*) from public.users u join public.user_roles ur on ur.user_id=u.id join public.roles r on r.id=ur.role_id where u.is_active and r.code='administrator') <= 1 then
    raise exception 'At least one active Administrator must remain' using errcode='23514';
  end if;

  insert into public.users(id,username,display_name,member_id,is_active,updated_at)
    values(p_auth_user_id,lower(btrim(p_username)),btrim(p_display_name),p_member_id,effective_is_active,now())
    on conflict(id) do update set username=excluded.username,display_name=excluded.display_name,
      member_id=excluded.member_id,updated_at=now();
  delete from public.user_roles where user_id=p_auth_user_id and role_id not in(select id from public.roles where code=any(p_role_codes));
  insert into public.user_roles(user_id,role_id,assigned_by)
    select p_auth_user_id,r.id,p_caller_user_id from public.roles r where r.code=any(p_role_codes)
    on conflict(user_id,role_id) do nothing;
  return jsonb_build_object('verified',true);
end;
$$;
revoke all on function public.admin_user_upsert(uuid,uuid,text,text,uuid,boolean,text[]) from public,anon,authenticated;
grant execute on function public.admin_user_upsert(uuid,uuid,text,text,uuid,boolean,text[]) to service_role;

commit;
