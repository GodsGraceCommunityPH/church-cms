-- Run after 009_prevent_duplicate_training_enrollment.sql.

select
  to_regprocedure('public.enroll_training_batch_students(uuid,uuid[])') is not null
    as enrollment_function_exists;

select not exists (
  select 1
  from information_schema.routine_privileges
  where routine_schema = 'public'
    and routine_name = 'enroll_training_batch_students'
    and grantee = 'anon'
) as anon_cannot_enroll_students;

select exists (
  select 1
  from pg_constraint
  where conrelid = 'public.member_trainings'::regclass
    and contype = 'u'
    and pg_get_constraintdef(oid) like '%(member_id, training_id)%'
) as member_program_unique_constraint_preserved;
