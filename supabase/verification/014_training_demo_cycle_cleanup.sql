select routine_name, security_type from information_schema.routines
where routine_schema = 'public' and routine_name in ('get_or_create_training_cycle', 'delete_cancelled_training_cycle');
select has_function_privilege('anon', 'public.delete_cancelled_training_cycle(uuid)', 'execute') as anon_can_delete,
       has_function_privilege('authenticated', 'public.delete_cancelled_training_cycle(uuid)', 'execute') as authenticated_can_call;
