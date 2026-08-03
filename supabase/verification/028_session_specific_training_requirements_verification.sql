-- Run after migrations 026 and 028 in a non-production verification environment.

select to_regclass('public.training_session_requirements') as assignment_table_exists;

select has_function_privilege('authenticated','public.set_training_session_requirements(uuid,uuid[])','EXECUTE')
  as authenticated_can_assign;
select has_function_privilege('anon','public.set_training_session_requirements(uuid,uuid[])','EXECUTE')
  as anon_cannot_assign;

-- Every preserved progress record must have a matching session assignment.
select count(*) as progress_without_assignment
from public.member_training_session_requirement_progress progress
left join public.training_session_requirements assignment
  on assignment.training_session_id=progress.training_session_id
 and assignment.program_requirement_id=progress.program_requirement_id
where assignment.id is null;

-- Assignments must connect a session and requirement from the same program.
select count(*) as cross_program_assignments
from public.training_session_requirements assignment
join public.training_sessions session on session.id=assignment.training_session_id
join public.training_batches batch on batch.id=session.batch_id
join public.training_program_requirements requirement on requirement.id=assignment.program_requirement_id
where requirement.training_id<>batch.training_id;

-- Review the actual per-session combinations. Sessions with no rows correctly
-- have no additional requirements.
select training.name as program,batch.name as class,session.title,
       coalesce(string_agg(requirement.name,', ' order by requirement.display_order),'None') as requirements
from public.training_sessions session
join public.training_batches batch on batch.id=session.batch_id
join public.trainings training on training.id=batch.training_id
left join public.training_session_requirements assignment on assignment.training_session_id=session.id
left join public.training_program_requirements requirement on requirement.id=assignment.program_requirement_id
group by training.name,batch.name,session.id,session.title,session.display_order
order by training.name,batch.name,session.display_order;
