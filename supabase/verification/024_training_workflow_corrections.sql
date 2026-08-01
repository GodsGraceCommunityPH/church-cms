-- Run after migration 024. These checks are read-only.
select to_regprocedure('public.complete_training_enrollment(uuid,uuid,text)') as completion_rpc,
       to_regprocedure('public.complete_training_enrollment(uuid,uuid,text,boolean)') as removed_override_rpc,
       to_regprocedure('public.reschedule_training_session(uuid,date,boolean,text)') as reschedule_rpc,
       to_regprocedure('public.close_training_class(uuid)') as close_class_rpc,
       to_regprocedure('public.archive_training_class(uuid)') as archive_class_rpc;

select count(*) as attendance_outside_enrollment_class
from public.training_attendance attendance
join public.member_trainings enrollment on enrollment.id = attendance.member_training_id
join public.training_sessions session on session.id = attendance.session_id
where enrollment.batch_id is distinct from session.batch_id;

select workflow_status, count(*) from public.member_trainings
where archived_at is null group by workflow_status order by workflow_status;

select batch.id, batch.name, batch.status,
  count(*) filter (where enrollment.workflow_status = 'pending_enrollment') as pending,
  count(*) filter (where enrollment.workflow_status in ('in_progress','for_remedial','ready_for_completion')) as active
from public.training_batches batch
left join public.member_trainings enrollment on enrollment.batch_id = batch.id and enrollment.archived_at is null
where batch.status in ('open','ongoing')
group by batch.id, batch.name, batch.status order by batch.name;
