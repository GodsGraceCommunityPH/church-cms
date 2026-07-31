select routine_name,security_type from information_schema.routines where routine_schema='public' and routine_name='delete_unreferenced_member';
select has_function_privilege('anon','public.delete_unreferenced_member(uuid)','execute') as anon_can_delete_member;
