-- Run after 011_remove_training_requirements.sql.

select
  to_regclass('public.training_requirements') is null
    as program_requirements_removed,
  to_regclass('public.member_training_requirements') is null
    as requirement_progress_removed,
  to_regprocedure('public.ready_when_requirements_complete()') is null
    as automatic_graduation_readiness_removed;

select exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'training_remedials'
) as remedials_preserved;

select
  to_regclass('public.training_sessions') is not null as sessions_preserved,
  to_regclass('public.training_attendance') is not null as attendance_preserved,
  to_regclass('public.training_notes') is not null as notes_preserved,
  to_regclass('public.training_advancement_eligibility') is not null
    as advancement_preserved;
