select column_name from information_schema.columns where table_schema='public' and table_name='training_batches' and column_name in ('required_sessions','cadence_days','excused_counts');
select routine_name,security_type from information_schema.routines where routine_schema='public' and routine_name in ('create_training_cycle','start_training_cycle','record_training_attendance','complete_training_enrollment','reopen_training_enrollment');
select has_function_privilege('anon','public.record_training_attendance(uuid,uuid,text)','execute') as anon_can_record_attendance;
