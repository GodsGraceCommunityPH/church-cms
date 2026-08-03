select trigger_name,action_timing,event_manipulation
from information_schema.triggers
where event_object_schema='public'
  and event_object_table='training_session_requirements'
  and trigger_name='protect_used_session_requirement_removal';

select count(*) as used_assignments_protected
from public.training_session_requirements assignment
where exists(
  select 1 from public.member_training_session_requirement_progress progress
  where progress.training_session_id=assignment.training_session_id
    and progress.program_requirement_id=assignment.program_requirement_id
);
