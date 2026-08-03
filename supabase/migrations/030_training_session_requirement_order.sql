begin;

-- Additive follow-up: migration 028 may already be installed. Existing
-- assignments retain their IDs and receive a deterministic default order.
alter table public.training_session_requirements
  add column if not exists display_order integer not null default 0;

with ranked as (
  select assignment.id,
         row_number() over (
           partition by assignment.training_session_id
           order by requirement.display_order,assignment.created_at,assignment.id
         )-1 as desired_order
  from public.training_session_requirements assignment
  join public.training_program_requirements requirement
    on requirement.id=assignment.program_requirement_id
)
update public.training_session_requirements assignment
set display_order=ranked.desired_order
from ranked where ranked.id=assignment.id;

create index if not exists training_session_requirement_order_idx
  on public.training_session_requirements(training_session_id,display_order,created_at);

commit;

-- Recovery guidance: this column and index are metadata-only. If rollback is
-- required before clients depend on ordering, drop the index and then drop the
-- display_order column. Do not drop the assignment table or progress records.
