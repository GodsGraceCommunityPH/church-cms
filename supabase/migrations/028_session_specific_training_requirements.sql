begin;

create table if not exists public.training_session_requirements (
  id uuid primary key default gen_random_uuid(),
  training_session_id uuid not null references public.training_sessions(id) on delete restrict,
  program_requirement_id uuid not null references public.training_program_requirements(id) on delete restrict,
  assigned_by uuid references public.users(id) on delete set null default auth.uid(),
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(training_session_id, program_requirement_id)
);

create index if not exists training_session_requirements_session_idx
  on public.training_session_requirements(training_session_id, created_at);

-- Existing checked progress is authoritative evidence that the requirement was
-- used in that session. Unchecked program-wide placeholders are not fabricated.
insert into public.training_session_requirements(training_session_id, program_requirement_id)
select distinct progress.training_session_id, progress.program_requirement_id
from public.member_training_session_requirement_progress progress
join public.training_sessions session on session.id=progress.training_session_id
join public.training_batches batch on batch.id=session.batch_id
join public.training_program_requirements requirement
  on requirement.id=progress.program_requirement_id
 and requirement.training_id=batch.training_id
on conflict(training_session_id,program_requirement_id) do nothing;

alter table public.training_session_requirements enable row level security;
revoke all on public.training_session_requirements from public,anon,authenticated;
grant select on public.training_session_requirements to authenticated;
drop policy if exists "Training viewers read session requirement assignments"
  on public.training_session_requirements;
create policy "Training viewers read session requirement assignments"
on public.training_session_requirements for select to authenticated
using(public.has_permission('training.view'));

create or replace function public.set_training_session_requirements(
  p_session_id uuid,
  p_requirement_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  target_session public.training_sessions%rowtype;
  target_training_id uuid;
  class_status text;
  current_session_id uuid;
  current_order integer;
  requested_id uuid;
begin
  if not public.has_permission('training.enroll') then
    raise exception 'training.enroll permission required' using errcode='42501';
  end if;

  select session.* into target_session
  from public.training_sessions session
  where session.id=p_session_id
  for update;
  if not found then raise exception 'Training session not found' using errcode='P0002'; end if;
  select batch.training_id,batch.status::text into target_training_id,class_status
  from public.training_batches batch where batch.id=target_session.batch_id;

  if class_status not in ('open','ongoing') then
    raise exception 'Requirements cannot be changed for a historical class' using errcode='P0001';
  end if;
  if class_status='ongoing' then
    current_session_id:=public.get_current_training_session(target_session.batch_id);
    if current_session_id is null then
      raise exception 'All sessions are completed and read-only' using errcode='P0001';
    end if;
    select display_order into current_order from public.training_sessions where id=current_session_id;
    if target_session.display_order<current_order then
      raise exception 'Completed session requirements are read-only' using errcode='P0001';
    end if;
  end if;

  foreach requested_id in array coalesce(p_requirement_ids,array[]::uuid[]) loop
    if not exists(
      select 1 from public.training_program_requirements requirement
      where requirement.id=requested_id
        and requirement.training_id=target_training_id
        and requirement.is_active
    ) and not exists(
      select 1 from public.training_session_requirements assignment
      where assignment.training_session_id=p_session_id
        and assignment.program_requirement_id=requested_id
    ) then
      raise exception 'Requirement is inactive or does not belong to this Training program' using errcode='P0001';
    end if;
  end loop;

  delete from public.training_session_requirements assignment
  where assignment.training_session_id=p_session_id
    and not(assignment.program_requirement_id=any(coalesce(p_requirement_ids,array[]::uuid[])));

  insert into public.training_session_requirements(training_session_id,program_requirement_id,assigned_by)
  select p_session_id,requested.id,auth.uid()
  from unnest(coalesce(p_requirement_ids,array[]::uuid[])) requested(id)
  join public.training_program_requirements requirement
    on requirement.id=requested.id and requirement.training_id=target_training_id
  on conflict(training_session_id,program_requirement_id) do nothing;
end;
$$;

create or replace function public.record_training_session_requirement(
  p_enrollment_id uuid,
  p_session_id uuid,
  p_requirement_id uuid,
  p_completed boolean
)
returns void language plpgsql security definer set search_path='' as $$
declare enrollment_batch uuid; session_batch uuid; current_session uuid;
begin
  if not public.has_permission('training.attendance') then raise exception 'training.attendance permission required' using errcode='42501'; end if;
  select batch_id into enrollment_batch from public.member_trainings
    where id=p_enrollment_id and archived_at is null and workflow_status in ('in_progress','for_remedial','ready_for_completion');
  select batch_id into session_batch from public.training_sessions where id=p_session_id;
  current_session:=public.get_current_training_session(enrollment_batch);
  if enrollment_batch is null or session_batch is distinct from enrollment_batch or not exists(
    select 1 from public.training_session_requirements
    where training_session_id=p_session_id and program_requirement_id=p_requirement_id
  ) then
    raise exception 'Requirement is not assigned to this student session' using errcode='P0001';
  end if;
  if p_session_id is distinct from current_session then raise exception 'Completed and future sessions are read-only' using errcode='P0001'; end if;
  if p_completed then
    insert into public.member_training_session_requirement_progress(member_training_id,training_session_id,program_requirement_id,completed,completed_at,completed_by)
      values(p_enrollment_id,p_session_id,p_requirement_id,true,now(),auth.uid())
      on conflict(member_training_id,training_session_id,program_requirement_id) do update
      set completed=true,completed_at=now(),completed_by=auth.uid(),updated_at=now();
  else
    delete from public.member_training_session_requirement_progress
      where member_training_id=p_enrollment_id and training_session_id=p_session_id and program_requirement_id=p_requirement_id;
  end if;
end;
$$;

revoke all on function public.set_training_session_requirements(uuid,uuid[]) from public,anon;
grant execute on function public.set_training_session_requirements(uuid,uuid[]) to authenticated;

commit;
