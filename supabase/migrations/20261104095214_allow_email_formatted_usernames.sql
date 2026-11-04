begin;

-- Accept regular CMS usernames and email-formatted login identifiers.
-- Existing assignments and the case-insensitive unique index are unchanged.
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
  if not (
    p_username ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{2,39}$'
    or (
      char_length(p_username) <= 254
      and p_username ~ '^[A-Za-z0-9!#$%&''*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&''*+/=?^_`{|}~-]+)*@[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$'
    )
  ) then
    raise exception 'Enter a 3–40 character username or a valid email address up to 254 characters' using errcode='22023';
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

commit;
