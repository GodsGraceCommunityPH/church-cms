-- Run after 008_batch_training_ux.sql.

select
  count(*) = 76 as all_enrollments_still_preserved,
  count(*) filter (where legacy_status is not null) = 76
    as imported_records_still_identifiable
from public.member_trainings;

select
  to_regprocedure('public.archive_imported_training_enrollments()') is not null
    as archive_utility_created,
  to_regprocedure('public.enroll_training_batch_students(uuid,uuid[])') is not null
    as batch_enrollment_created;

select
  exists (
    select 1 from pg_trigger
    where tgname = 'create_member_training_checklist'
      and not tgisinternal
  ) as enrollment_checklist_trigger_created,
  exists (
    select 1 from pg_trigger
    where tgname = 'propagate_training_requirement'
      and not tgisinternal
  ) as requirement_propagation_trigger_created,
  exists (
    select 1 from pg_trigger
    where tgname = 'ready_when_requirements_complete'
      and not tgisinternal
  ) as graduation_readiness_trigger_created;

select not exists (
  select 1
  from information_schema.routine_privileges
  where routine_schema = 'public'
    and routine_name in (
      'archive_imported_training_enrollments',
      'enroll_training_batch_students'
    )
    and grantee = 'anon'
) as anon_cannot_execute_training_utilities;

-- Run this only after intentionally using Reset Imported Data:
-- select
--   count(*) filter (where archived_at is not null) = 76
--     as imported_records_archived,
--   count(*) filter (where archived_at is null) = 0
--     as operational_training_starts_empty
-- from public.member_trainings
-- where legacy_status is not null;
