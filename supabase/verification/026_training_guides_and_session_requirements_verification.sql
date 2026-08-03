-- Run after migration 026 in a non-production verification environment.
-- Baseline counts must be captured before applying 026 and remain unchanged.
select 'member_trainings' as entity, count(*) from public.member_trainings
union all select 'training_attendance', count(*) from public.training_attendance
union all select 'training_remedials', count(*) from public.training_remedials
union all select 'completed_enrollments', count(*) from public.member_trainings where workflow_status='completed';

select member_training_id, count(*) as active_guides
from public.member_training_guide_assignments where ended_at is null
group by member_training_id having count(*) > 1;

select assignment.member_training_id, assignment.guide_member_id,
       assignment.assigned_at, assignment.ended_at, assignment.assigned_by
from public.member_training_guide_assignments assignment
order by assignment.member_training_id, assignment.assigned_at;

select id, member_id, cell_group_id_at_enrollment, cell_leader_member_id_at_enrollment
from public.member_trainings
where cell_group_id_at_enrollment is not null
order by created_at desc;

select requirement.training_id, requirement.id, requirement.name,
       requirement.display_order, requirement.is_active
from public.training_program_requirements requirement
order by requirement.training_id, requirement.display_order;

select member_training_id, training_session_id, program_requirement_id, count(*)
from public.member_training_session_requirement_progress
group by member_training_id, training_session_id, program_requirement_id
having count(*) > 1;

-- Expected: anon has no table privileges and no RPC EXECUTE privileges.
select table_name, privilege_type from information_schema.role_table_grants
where grantee='anon' and table_schema='public'
  and table_name in ('member_training_guide_assignments','training_program_requirements','member_training_session_requirement_progress');

select routine_name, privilege_type from information_schema.role_routine_grants
where grantee='anon' and specific_schema='public'
  and routine_name in ('enroll_training_batch_students_with_guides','change_training_guide','save_training_program_requirement','set_training_program_requirement_active','record_training_session_requirement');

-- Authenticated functional checks (run with an authenticated JWT):
select public.has_permission('training.view') as can_view,
       public.has_permission('training.enroll') as can_enroll,
       public.has_permission('training.attendance') as can_record_progress;
