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

select public.has_permission('ministries.view') as can_view_ministries,
       public.has_permission('ministries.manage') as can_manage_ministries;
