-- Read-only verification for migration 023.
select to_regprocedure('public.cancel_training_enrollment(uuid,text)') as cancel_rpc,
       to_regprocedure('public.restore_training_enrollment(uuid,uuid,text)') as restore_rpc,
       to_regprocedure('public.withdraw_training_enrollment(uuid,text)') as withdraw_rpc,
       to_regprocedure('public.reopen_training_enrollment(uuid,text)') as reopen_rpc,
       to_regprocedure('public.reopen_training_enrollment(uuid)') as retired_legacy_reopen_rpc;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'member_trainings'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'member_trainings'
  and indexname = 'member_trainings_one_active_program_idx';

select event_type, count(*)
from public.member_training_workflow_events
group by event_type
order by event_type;

select role.code as role_code, permission.code as permission_code
from public.roles role
join public.role_permissions assignment on assignment.role_id = role.id
join public.permissions permission on permission.id = assignment.permission_id
where role.code in ('administrator', 'trainer')
  and permission.code like 'training.%'
order by role.code, permission.code;
