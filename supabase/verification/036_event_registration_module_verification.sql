select to_regclass('public.events') as events_table,to_regclass('public.event_registrations') as registrations_table;
select code,module from public.permissions where code like 'events.%' order by code;
select role.code,permission.code from public.role_permissions assignment join public.roles role on role.id=assignment.role_id join public.permissions permission on permission.id=assignment.permission_id where permission.code like 'events.%' order by role.code,permission.code;
select to_regprocedure('public.get_public_event(text)') as public_event_rpc,to_regprocedure('public.register_for_event(text,text,text,text,text,text,integer,text)') as registration_rpc;
select tablename,policyname,roles,cmd from pg_policies where schemaname='public' and tablename in ('events','event_registrations') order by tablename,policyname;
select count(*) as events_should_be_zero from public.events;
select count(*) as registrations_should_be_zero from public.event_registrations;
