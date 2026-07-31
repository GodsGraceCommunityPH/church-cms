-- Run after 010_single_active_training_cycle.sql.

select not exists (
  select training_id
  from public.training_batches
  where status in ('open', 'ongoing')
  group by training_id
  having count(*) > 1
) as one_active_cycle_per_program;

select not exists (
  select member_id, training_id
  from public.member_trainings
  where archived_at is null
    and workflow_status in (
      'pending_enrollment',
      'in_progress',
      'for_remedial',
      'ready_for_completion'
    )
  group by member_id, training_id
  having count(*) > 1
) as one_active_enrollment_per_member_program;

select
  to_regprocedure('public.get_or_create_training_cycle(uuid)') is not null
    as cycle_helper_created,
  to_regprocedure('public.complete_training_cycle(uuid)') is not null
    as cycle_completion_created,
  to_regprocedure('public.assign_pending_to_training_cycle(uuid,boolean)') is not null
    as pending_assignment_created;

select not exists (
  select 1
  from information_schema.routine_privileges
  where routine_schema = 'public'
    and routine_name in (
      'get_or_create_training_cycle',
      'complete_training_cycle',
      'assign_pending_to_training_cycle'
    )
    and grantee = 'anon'
) as anon_cannot_manage_cycles;
