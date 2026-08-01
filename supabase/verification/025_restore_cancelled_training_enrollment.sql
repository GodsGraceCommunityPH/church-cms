-- Read-only verification after migration 025.
select to_regprocedure(
  'public.restore_training_enrollment(uuid,uuid,text)'
) as restore_rpc;

select routine_name, security_type, data_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'restore_training_enrollment';

select
  has_function_privilege(
    'authenticated',
    'public.restore_training_enrollment(uuid,uuid,text)',
    'execute'
  ) as authenticated_can_restore,
  has_function_privilege(
    'anon',
    'public.restore_training_enrollment(uuid,uuid,text)',
    'execute'
  ) as anon_can_restore;

select event_type, previous_status, new_status, count(*)
from public.member_training_workflow_events
where event_type = 'restored'
group by event_type, previous_status, new_status
order by previous_status, new_status;
