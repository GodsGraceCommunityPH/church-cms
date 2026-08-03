-- Run in a non-production verification environment after migration 027.
select has_function_privilege('authenticated',
  'public.correct_completed_student_session_record(uuid,uuid,text,jsonb,text)','EXECUTE') as authenticated_can_execute;
select has_function_privilege('anon',
  'public.correct_completed_student_session_record(uuid,uuid,text,jsonb,text)','EXECUTE') as anon_cannot_execute;

-- After a correction, confirm one audit event and unchanged session/class state.
select event_type,member_training_id,reason,acted_by,acted_at,snapshot
from public.member_training_workflow_events
where event_type='student_record_corrected'
order by acted_at desc limit 10;

select session.id,session.title,batch.status as class_status,
       session.attendance_reopened_at
from public.training_sessions session
join public.training_batches batch on batch.id=session.batch_id
where session.id = '<corrected-session-id>'::uuid;

select member_training_id,session_id,status,recorded_by,recorded_at
from public.training_attendance
where member_training_id='<corrected-enrollment-id>'::uuid
  and session_id='<corrected-session-id>'::uuid;

select member_training_id,training_session_id,program_requirement_id,completed,completed_by,completed_at
from public.member_training_session_requirement_progress
where member_training_id='<corrected-enrollment-id>'::uuid
  and training_session_id='<corrected-session-id>'::uuid;
