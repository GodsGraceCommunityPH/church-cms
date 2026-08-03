select count(*) as assignments_without_order
from public.training_session_requirements where display_order is null;

select training_session_id,program_requirement_id,display_order
from public.training_session_requirements
order by training_session_id,display_order,created_at;
