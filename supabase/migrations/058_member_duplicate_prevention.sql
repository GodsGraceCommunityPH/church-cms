begin;

-- Keep display values unchanged. This canonical form is comparison-only and
-- intentionally does not create a unique index: household phones are shared.
create or replace function public.normalize_member_mobile(p_value text)
returns text language sql immutable set search_path = '' as $$
  with digits as (
    select regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g') as value
  )
  select case
    when value ~ '^09[0-9]{9}$' then '63' || substr(value, 2)
    when value ~ '^9[0-9]{9}$' then '63' || value
    when value ~ '^639[0-9]{9}$' then value
    else value
  end from digits;
$$;

create or replace function public.member_first_names_similar(p_left text, p_right text)
returns boolean language sql immutable set search_path = '' as $$
  select case
    when public.normalize_member_registration_name(p_left) = ''
      or public.normalize_member_registration_name(p_right) = '' then false
    else
      split_part(public.normalize_member_registration_name(p_left), ' ', 1) =
        split_part(public.normalize_member_registration_name(p_right), ' ', 1)
      and (
        public.normalize_member_registration_name(p_left) like public.normalize_member_registration_name(p_right) || ' %'
        or public.normalize_member_registration_name(p_right) like public.normalize_member_registration_name(p_left) || ' %'
        or public.normalize_member_registration_name(p_left) = public.normalize_member_registration_name(p_right)
      )
  end;
$$;

-- A single transaction-scoped lock makes candidate checks and inserts serial,
-- including requests whose names/mobile numbers overlap in different ways.
create or replace function public.guard_member_duplicate_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  same_person_exists boolean;
  shared_contact_exists boolean;
begin
  perform pg_advisory_xact_lock(731004220118);

  select exists (
    select 1 from public.members m
    where public.normalize_member_registration_name(m.last_name) = public.normalize_member_registration_name(new.last_name)
      and public.member_first_names_similar(m.first_name, new.first_name)
  ) into same_person_exists;
  select exists (
    select 1 from public.members m
    where public.normalize_member_mobile(m.mobile) <> ''
      and public.normalize_member_mobile(m.mobile) = public.normalize_member_mobile(new.mobile)
  ) into shared_contact_exists;

  if (same_person_exists or shared_contact_exists)
     and current_setting('ggccc.member_duplicate_confirmed', true) is distinct from 'on' then
    raise exception 'Potential member duplicate requires confirmation or staff review'
      using errcode = 'P0001', detail = 'member_duplicate_review_required';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_member_duplicate_insert() from public, anon, authenticated;

drop trigger if exists members_duplicate_insert_guard on public.members;
create trigger members_duplicate_insert_guard before insert on public.members
for each row execute function public.guard_member_duplicate_insert();

-- Admin entry point. A fresh database check is performed on every attempt;
-- a candidate discovered after the browser's preview returns for review and
-- cannot be bypassed by the earlier client-side result.
create or replace function public.create_member_with_duplicate_check(
  p_member jsonb,
  p_reviewed_member_ids uuid[] default '{}'::uuid[]
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  candidate_count integer;
  candidates jsonb;
  candidate_ids uuid[];
begin
  if not public.has_permission('members.create') then
    raise exception 'Member creation permission is required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(731004220118);

  select count(*), coalesce(array_agg(m.id order by m.id), '{}'::uuid[]), coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'first_name', m.first_name, 'last_name', m.last_name, 'mobile', m.mobile,
    'match_kind', case when public.normalize_member_registration_name(m.last_name) = public.normalize_member_registration_name(p_member->>'last_name')
      and public.member_first_names_similar(m.first_name, p_member->>'first_name') then 'likely_same_person' else 'possible_shared_contact' end
  )), '[]'::jsonb)
  into candidate_count, candidate_ids, candidates
  from public.members m
  where (public.normalize_member_registration_name(m.last_name) = public.normalize_member_registration_name(p_member->>'last_name')
      and public.member_first_names_similar(m.first_name, p_member->>'first_name'))
     or (public.normalize_member_mobile(m.mobile) <> ''
      and public.normalize_member_mobile(m.mobile) = public.normalize_member_mobile(p_member->>'mobile'));

  if candidate_count > 0 and coalesce(p_reviewed_member_ids, '{}'::uuid[]) <> candidate_ids then
    return jsonb_build_object('status', 'needs_confirmation', 'candidates', candidates);
  end if;

  if candidate_count > 0 then perform set_config('ggccc.member_duplicate_confirmed', 'on', true); end if;
  insert into public.members(first_name,last_name,nickname,gender,birthday,membership_status,cell_group_id,mobile,email,address,remarks)
  values (p_member->>'first_name',p_member->>'last_name',coalesce(p_member->>'nickname',''),p_member->>'gender',
    nullif(p_member->>'birthday','')::date,p_member->>'membership_status',nullif(p_member->>'cell_group_id','')::uuid,
    nullif(p_member->>'mobile',''),nullif(p_member->>'email',''),coalesce(p_member->>'address',''),coalesce(p_member->>'remarks',''));
  return jsonb_build_object('status','created');
end;
$$;
revoke all on function public.create_member_with_duplicate_check(jsonb,uuid[]) from public, anon;
grant execute on function public.create_member_with_duplicate_check(jsonb,uuid[]) to authenticated;

-- Keep the existing public registration contract while extending its match
-- logic. Likely matches require an explicit response; multiple candidates are
-- queued. A shared phone with a different name is never auto-linked and always
-- goes to staff review. Explicit create_new confirms a distinct person.
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
  candidates public.members%rowtype;
  candidate_count integer;
  likely_count integer;
  shared_count integer;
  candidate_json jsonb;
  matched_display_name text;
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

  if candidate_count > 1 or shared_count > 0 then
    insert into public.member_registration_reviews(request_id,cell_group_id,normalized_first_name,normalized_last_name,
      submitted_profile,matched_profile_count)
    values (p_request_id,target_cell_group_id,public.normalize_member_registration_name(clean_first),
      public.normalize_member_registration_name(clean_last),
      jsonb_build_object('first_name',clean_first,'last_name',clean_last,'nickname',nullif(btrim(coalesce(p_nickname,'')),''),
        'gender',p_gender,'birthday',p_birthday,'mobile',nullif(btrim(coalesce(p_mobile,'')),''),
        'email',nullif(btrim(coalesce(p_email,'')),''),'address',nullif(btrim(coalesce(p_address,'')),''),
        'duplicate_candidates',candidate_json), greatest(candidate_count,2)
    on conflict(request_id) do nothing;
    return jsonb_build_object('status','needs_review');
  end if;
  if likely_count=1 and p_match_decision is null then
    select concat_ws(' ',m.first_name,m.last_name) into matched_display_name
      from public.members m where m.id=(candidate_json->0->>'id')::uuid;
    return jsonb_build_object('status','needs_confirmation','display_name',matched_display_name);
  end if;
  if likely_count=1 and p_match_decision='confirm_existing' then
    select m.* into candidates from public.members m
      where public.normalize_member_registration_name(m.last_name)=public.normalize_member_registration_name(clean_last)
        and public.member_first_names_similar(m.first_name,clean_first) limit 1 for update;
    update public.members set first_name=clean_first,last_name=clean_last,
      nickname=coalesce(nullif(btrim(coalesce(p_nickname,'')),''),candidates.nickname),
      gender=coalesce(nullif(btrim(coalesce(p_gender,'')),''),candidates.gender),birthday=coalesce(p_birthday,candidates.birthday),
      mobile=coalesce(nullif(btrim(coalesce(p_mobile,'')),''),candidates.mobile),
      email=coalesce(nullif(btrim(coalesce(p_email,'')),''),candidates.email),
      address=coalesce(nullif(btrim(coalesce(p_address,'')),''),candidates.address),
      cell_group_id=coalesce(candidates.cell_group_id,target_cell_group_id) where id=candidates.id;
    return jsonb_build_object('status','updated');
  end if;
  if likely_count=1 and p_match_decision='create_new' then perform set_config('ggccc.member_duplicate_confirmed','on',true); end if;
  if likely_count=0 and p_match_decision='confirm_existing' then
    raise exception 'The existing profile is no longer available for confirmation' using errcode='P0002';
  end if;
  if likely_count=1 and p_match_decision is null then
    select concat_ws(' ',m.first_name,m.last_name) into matched_display_name
      from public.members m where m.id=(candidate_json->0->>'id')::uuid;
    return jsonb_build_object('status','needs_confirmation','display_name',matched_display_name);
  end if;
  perform set_config('ggccc.member_invite_registration','on',true);
  insert into public.members(first_name,last_name,nickname,gender,birthday,mobile,email,address,cell_group_id,membership_status,remarks)
  values(clean_first,clean_last,coalesce(nullif(btrim(coalesce(p_nickname,'')),''),''),p_gender,p_birthday,
    coalesce(nullif(btrim(coalesce(p_mobile,'')),''),''),coalesce(nullif(btrim(coalesce(p_email,'')),''),''),
    coalesce(nullif(btrim(coalesce(p_address,'')),''),''),target_cell_group_id,'Visitor','');
  return jsonb_build_object('status','created');
end;
$$;

revoke all on function public.normalize_member_mobile(text) from public, anon, authenticated;
revoke all on function public.member_first_names_similar(text,text) from public, anon, authenticated;
grant execute on function public.normalize_member_mobile(text) to authenticated;
grant execute on function public.member_first_names_similar(text,text) to authenticated;
revoke all on function public.submit_cell_group_member_registration(uuid,text,text,text,text,text,date,text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_cell_group_member_registration(uuid,text,text,text,text,text,date,text,text,text,text) to anon, authenticated;

commit;
