begin;

do $$
declare
  missing_emails text;
begin
  select string_agg(requested.email, ', ')
  into missing_emails
  from (values ('admin1@ggccc.com'), ('test@ggccc.com')) requested(email)
  where not exists (
    select 1 from auth.users auth_user
    where lower(auth_user.email) = requested.email
  );

  if missing_emails is not null then
    raise exception 'Supabase Auth users not found: %', missing_emails;
  end if;

  if not exists (select 1 from public.roles where code = 'administrator') then
    raise exception 'The administrator role is missing. Apply migration 005 first.';
  end if;
end;
$$;

insert into public.users (id, display_name, is_active)
select
  auth_user.id,
  coalesce(
    nullif(auth_user.raw_user_meta_data ->> 'display_name', ''),
    nullif(split_part(auth_user.email, '@', 1), ''),
    'Portal Administrator'
  ),
  true
from auth.users auth_user
where lower(auth_user.email) in ('admin1@ggccc.com', 'test@ggccc.com')
on conflict (id) do update
set is_active = true,
    updated_at = now();

insert into public.user_roles (user_id, role_id)
select auth_user.id, role_record.id
from auth.users auth_user
cross join public.roles role_record
where lower(auth_user.email) in ('admin1@ggccc.com', 'test@ggccc.com')
  and role_record.code = 'administrator'
on conflict (user_id, role_id) do nothing;

commit;
