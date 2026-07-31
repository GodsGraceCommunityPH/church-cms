-- Run after 007_operational_training_workflow.sql.
-- Every assertion must return true.

select count(*) = 76 as all_legacy_rows_preserved
from public.member_trainings;

select
  count(*) filter (where workflow_status = 'pending_enrollment') = 12
    as pending_count_matches,
  count(*) filter (where workflow_status = 'in_progress') = 30
    as active_count_matches,
  count(*) filter (where workflow_status = 'completed') = 34
    as completed_count_matches,
  count(*) = 76 as total_count_matches
from public.member_trainings;

select
  count(*) filter (where legacy_status = 'Not Started') = 12
    as original_pending_labels_preserved,
  count(*) filter (where legacy_status = 'In Progress') = 30
    as original_active_labels_preserved,
  count(*) filter (where legacy_status = 'Completed') = 34
    as original_completed_labels_preserved
from public.member_trainings;

select count(*) = 10 as sol_2_enrollments_preserved
from public.member_trainings mt
join public.trainings t on t.id = mt.training_id
where lower(trim(t.name)) = 'sol 2';

select not exists (
  select 1
  from public.member_trainings
  where workflow_status is null
     or workflow_status not in (
    'pending_enrollment',
    'in_progress',
    'for_remedial',
    'ready_for_completion',
    'completed',
    'withdrawn',
    'cancelled'
  )
) as all_statuses_valid;

select
  count(*) filter (
    where status::text = 'Not Started'
      and workflow_status = 'pending_enrollment'
  ) = 12 as legacy_pending_enum_preserved,
  count(*) filter (
    where status::text = 'In Progress'
      and workflow_status = 'in_progress'
  ) = 30 as legacy_active_enum_preserved,
  count(*) filter (
    where status::text = 'Completed'
      and workflow_status = 'completed'
  ) = 34 as legacy_completed_enum_preserved
from public.member_trainings;

select
  to_regclass('public.training_batches') is not null as batches_created,
  to_regclass('public.training_requirements') is not null as requirements_created,
  to_regclass('public.member_training_requirements') is not null as progress_created,
  to_regclass('public.training_sessions') is not null as sessions_created,
  to_regclass('public.training_attendance') is not null as attendance_created,
  to_regclass('public.training_notes') is not null as notes_created,
  to_regclass('public.training_remedials') is not null as remedials_created,
  to_regclass('public.training_advancement_eligibility') is not null
    as advancement_created,
  to_regclass('public.member_training_status_history') is not null
    as status_history_created;

-- Trainer must retain only view and attendance from the operational permissions.
select
  bool_and(
    case
      when p.code in ('training.view', 'training.attendance') then true
      else false
    end
  ) as trainer_least_privilege_preserved
from public.role_permissions rp
join public.roles r on r.id = rp.role_id
join public.permissions p on p.id = rp.permission_id
where r.code = 'trainer'
  and p.module = 'training';

-- Anonymous must have no table privileges on operational member-level data.
select not exists (
  select 1
  from information_schema.role_table_grants
  where grantee = 'anon'
    and table_schema = 'public'
    and table_name in (
      'member_trainings',
      'member_training_requirements',
      'training_attendance',
      'training_notes',
      'training_remedials',
      'training_advancement_eligibility',
      'member_training_status_history'
    )
) as anon_has_no_training_table_privileges;
