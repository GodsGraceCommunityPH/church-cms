select to_regclass('public.ministries') as ministries_table,
       to_regclass('public.ministry_members') as ministry_members_table;

select table_name, column_name, is_nullable, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('ministries', 'ministry_members')
order by table_name, ordinal_position;

select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('ministries', 'ministry_members')
order by tablename, policyname;

select id, name, public
from storage.buckets
where id = 'ministry-pictures';

-- Supabase SQL Editor does not run as a portal user, so auth.uid() is null and
-- calling has_permission() here would always return false. Verify the
-- Administrator grants structurally instead; exercise has_permission() from
-- an authenticated portal session or REST request.
select permission.code,
       exists (
         select 1
         from public.role_permissions role_permission
         join public.roles role on role.id = role_permission.role_id
         where role_permission.permission_id = permission.id
           and role.code = 'administrator'
       ) as granted_to_administrator
from public.permissions permission
where permission.code in ('ministries.view', 'ministries.manage')
order by permission.code;

select auth.uid() as sql_editor_auth_uid,
       'Expected to be null in Supabase SQL Editor' as note;
