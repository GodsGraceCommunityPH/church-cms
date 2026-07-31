select routine_name,security_type from information_schema.routines where routine_schema='public' and routine_name in ('delete_cancelled_training_cycle','delete_unrecorded_training_session');
select has_function_privilege('anon','public.delete_unrecorded_training_session(uuid)','execute') as anon_can_delete_session;
