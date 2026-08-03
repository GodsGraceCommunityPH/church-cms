-- Run after 032_edit_training_session_details.sql.
-- This verification is read-only and does not modify Training data.

select
  to_regprocedure('public.update_training_session_details(uuid,text,date)') is not null
    as function_exists;

select
  has_function_privilege(
    'authenticated',
    'public.update_training_session_details(uuid,text,date)',
    'execute'
  ) as authenticated_can_execute,
  not has_function_privilege(
    'anon',
    'public.update_training_session_details(uuid,text,date)',
    'execute'
  ) as anon_cannot_execute;

select
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.training_sessions'::regclass
  and contype = 'u'
order by conname;
