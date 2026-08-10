-- Run after migration 034.

select
  to_regprocedure(
    'public.correct_completed_student_session_record(uuid,uuid,text,jsonb,text)'
  ) is not null as correction_rpc_exists,
  has_function_privilege(
    'authenticated',
    'public.correct_completed_student_session_record(uuid,uuid,text,jsonb,text)',
    'EXECUTE'
  ) as authenticated_can_execute,
  not has_function_privilege(
    'anon',
    'public.correct_completed_student_session_record(uuid,uuid,text,jsonb,text)',
    'EXECUTE'
  ) as anon_cannot_execute;

-- A successful correction must produce one atomic audit event whose snapshot
-- retains the previous/new attendance and requirement values.
select
  event_type,
  member_training_id,
  reason,
  acted_by,
  acted_at,
  snapshot ->> 'session_id' as session_id,
  snapshot ->> 'previous_attendance' as previous_attendance,
  snapshot ->> 'new_attendance' as new_attendance,
  snapshot -> 'previous_requirements' as previous_requirements,
  snapshot -> 'new_requirements' as new_requirements
from public.member_training_workflow_events
where event_type = 'student_record_corrected'
order by acted_at desc
limit 10;

-- Stored attendance values must remain within the lowercase database domain.
select status, count(*)
from public.training_attendance
group by status
order by status;
