-- Run after 012_link_remedials_to_sessions.sql.

select exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'training_remedials'
    and column_name = 'session_id'
) as remedial_session_link_created;

select not exists (
  select 1
  from information_schema.role_table_grants
  where grantee = 'anon'
    and table_schema = 'public'
    and table_name = 'training_remedials'
) as anon_still_has_no_remedial_access;
