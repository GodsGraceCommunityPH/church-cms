select
  to_regprocedure('public.reset_training_cycle_for_demo(uuid)') is not null
    as reset_utility_created;

select not exists (
  select 1
  from information_schema.routine_privileges
  where routine_schema = 'public'
    and routine_name = 'reset_training_cycle_for_demo'
    and grantee = 'anon'
) as anon_cannot_reset_training;
