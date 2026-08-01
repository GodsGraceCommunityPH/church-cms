-- Read-only verification for migration 021.
select to_regprocedure('public.training_obligation_is_satisfied(uuid,uuid)') as obligation_helper,
       to_regprocedure('public.recalculate_training_eligibility(uuid)') as eligibility_helper,
       to_regprocedure('public.schedule_training_remedial(uuid,uuid,date,text)') as schedule_remedial,
       to_regprocedure('public.complete_training_remedial(uuid,date)') as complete_remedial,
       to_regprocedure('public.reopen_training_remedial(uuid)') as reopen_remedial;

-- Historical attendance remains present but these cross-class rows are excluded
-- by the new obligation helper and completion RPC.
select count(*) as preserved_cross_class_attendance_rows
from public.training_attendance attendance
join public.member_trainings enrollment on enrollment.id = attendance.member_training_id
join public.training_sessions session on session.id = attendance.session_id
where session.batch_id is distinct from enrollment.batch_id;

select enrollment.workflow_status, count(*)
from public.member_trainings enrollment
where enrollment.archived_at is null
group by enrollment.workflow_status
order by enrollment.workflow_status;

select count(*) as original_absences,
       count(*) filter (where remedial.status = 'completed') as absences_satisfied_by_remedial
from public.training_attendance attendance
left join public.training_remedials remedial
  on remedial.member_training_id = attendance.member_training_id
 and remedial.session_id = attendance.session_id
 and remedial.status <> 'cancelled'
where attendance.status = 'absent';
