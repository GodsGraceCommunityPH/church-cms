begin;

alter table public.member_trainings
  add column if not exists cancelled_at timestamptz,
  add column if not exists withdrawn_at timestamptz;

create table if not exists public.member_training_workflow_events (
  id uuid primary key default gen_random_uuid(),
  member_training_id uuid not null references public.member_trainings(id) on delete restrict,
  event_type text not null,
  previous_status text,
  new_status text not null,
  previous_batch_id uuid references public.training_batches(id) on delete set null,
  new_batch_id uuid references public.training_batches(id) on delete set null,
  previous_completed_at timestamptz,
  new_completed_at timestamptz,
  reason text,
  acted_by uuid references public.users(id) on delete set null,
  acted_at timestamptz not null default now(),
  snapshot jsonb not null default '{}'::jsonb
);

create index if not exists member_training_workflow_events_enrollment_idx
  on public.member_training_workflow_events (member_training_id, acted_at desc);

alter table public.member_training_workflow_events enable row level security;
revoke all on public.member_training_workflow_events from anon, authenticated;
grant select on public.member_training_workflow_events to authenticated;
drop policy if exists "Training viewers read workflow events"
  on public.member_training_workflow_events;
create policy "Training viewers read workflow events"
on public.member_training_workflow_events
for select to authenticated using (public.has_permission('training.view'));

create or replace function public.record_member_training_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  transition_reason text;
  transition_event text;
begin
  if old.workflow_status is distinct from new.workflow_status then
    transition_reason := nullif(current_setting('app.training_transition_reason', true), '');
    transition_event := case
      when old.workflow_status = 'pending_enrollment' and new.workflow_status = 'cancelled' then 'cancelled'
      when old.workflow_status = 'cancelled' and new.workflow_status = 'pending_enrollment' then 'restored'
      when old.workflow_status = 'in_progress' and new.workflow_status = 'withdrawn' then 'withdrawn'
      when old.workflow_status = 'completed' and new.workflow_status = 'in_progress' then 'reopened'
      when new.workflow_status = 'completed' then 'completed'
      when new.workflow_status = 'ready_for_completion' then 'became_eligible'
      when old.workflow_status = 'ready_for_completion' then 'eligibility_removed'
      else 'status_changed'
    end;

    insert into public.member_training_status_history (
      member_training_id, previous_status, new_status, changed_by
    ) values (
      new.id, old.workflow_status, new.workflow_status, auth.uid()
    );

    insert into public.member_training_workflow_events (
      member_training_id,
      event_type,
      previous_status,
      new_status,
      previous_batch_id,
      new_batch_id,
      previous_completed_at,
      new_completed_at,
      reason,
      acted_by,
      snapshot
    ) values (
      new.id,
      transition_event,
      old.workflow_status,
      new.workflow_status,
      old.batch_id,
      new.batch_id,
      old.completed_at,
      new.completed_at,
      transition_reason,
      auth.uid(),
      jsonb_build_object(
        'enrolled_at', old.created_at,
        'started_at', old.started_at,
        'cancelled_at', old.cancelled_at,
        'withdrawn_at', old.withdrawn_at,
        'previous_completed_at', old.completed_at,
        'new_completed_at', new.completed_at
      )
    );
  end if;

  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.cancel_training_enrollment(
  p_enrollment_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('training.enroll') then
    raise exception 'training.enroll permission required' using errcode = '42501';
  end if;
  perform set_config('app.training_transition_reason', coalesce(p_reason, ''), true);

  update public.member_trainings
  set workflow_status = 'cancelled', cancelled_at = now(), completed_at = null
  where id = p_enrollment_id
    and archived_at is null
    and workflow_status = 'pending_enrollment';

  if not found then
    raise exception 'Only a Pending Enrollment can be cancelled' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.restore_training_enrollment(
  p_enrollment_id uuid,
  p_batch_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_training_id uuid;
  enrollment_training_id uuid;
  enrollment_member_id uuid;
begin
  if not public.has_permission('training.enroll') then
    raise exception 'training.enroll permission required' using errcode = '42501';
  end if;

  select training_id into target_training_id
  from public.training_batches
  where id = p_batch_id and status = 'open';

  if target_training_id is null then
    raise exception 'Restore requires an open Current Class that has not started' using errcode = 'P0001';
  end if;

  select training_id, member_id into enrollment_training_id, enrollment_member_id
  from public.member_trainings
  where id = p_enrollment_id and workflow_status = 'cancelled'
  for update;

  if enrollment_training_id is null then
    raise exception 'Cancelled enrollment not found' using errcode = 'P0002';
  end if;
  if enrollment_training_id <> target_training_id then
    raise exception 'Cancelled enrollment belongs to a different Training program' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.member_trainings
    where member_id = enrollment_member_id
      and training_id = target_training_id
      and id <> p_enrollment_id
      and archived_at is null
      and workflow_status in (
        'pending_enrollment', 'in_progress', 'for_remedial', 'ready_for_completion'
      )
  ) then
    raise exception 'Member already has an active enrollment in this program' using errcode = '23505';
  end if;

  perform set_config('app.training_transition_reason', coalesce(p_reason, ''), true);
  update public.member_trainings
  set batch_id = p_batch_id,
      workflow_status = 'pending_enrollment',
      started_at = null,
      completed_at = null,
      cancelled_at = null,
      withdrawn_at = null,
      archived_at = null
  where id = p_enrollment_id;
end;
$$;

create or replace function public.withdraw_training_enrollment(
  p_enrollment_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('training.enroll') then
    raise exception 'training.enroll permission required' using errcode = '42501';
  end if;
  perform set_config('app.training_transition_reason', coalesce(p_reason, ''), true);

  update public.member_trainings
  set workflow_status = 'withdrawn', withdrawn_at = now(), completed_at = null
  where id = p_enrollment_id
    and archived_at is null
    and workflow_status = 'in_progress';

  if not found then
    raise exception 'Only an In Progress student can be withdrawn' using errcode = 'P0001';
  end if;
end;
$$;

drop function if exists public.reopen_training_enrollment(uuid);
create or replace function public.reopen_training_enrollment(
  p_enrollment_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('admin.settings') then
    raise exception 'Administrator permission required' using errcode = '42501';
  end if;
  perform set_config('app.training_transition_reason', coalesce(p_reason, ''), true);

  update public.member_trainings
  set workflow_status = 'in_progress', completed_at = null
  where id = p_enrollment_id and workflow_status = 'completed';

  if not found then
    raise exception 'Completed enrollment not found' using errcode = 'P0002';
  end if;

  perform public.recalculate_training_eligibility(p_enrollment_id);
end;
$$;

create or replace function public.enroll_training_batch_students(
  p_batch_id uuid,
  p_member_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_training_id uuid;
  target_status text;
  target_start date;
  requested_member uuid;
  latest_status text;
  changed_count integer := 0;
begin
  if not public.has_permission('training.enroll') then
    raise exception 'training.enroll permission required' using errcode = '42501';
  end if;

  select training_id, status, starts_on
    into target_training_id, target_status, target_start
  from public.training_batches
  where id = p_batch_id and status in ('open', 'ongoing');

  if target_training_id is null then
    raise exception 'Active Current Class not found' using errcode = 'P0002';
  end if;

  foreach requested_member in array p_member_ids loop
    if exists (
      select 1 from public.member_trainings
      where member_id = requested_member
        and training_id = target_training_id
        and archived_at is null
        and workflow_status in (
          'pending_enrollment', 'in_progress', 'for_remedial', 'ready_for_completion'
        )
    ) then
      continue;
    end if;

    -- Cancelled attempts require the explicit Restore action so their identity
    -- and audit history are not silently reused or duplicated.
    select workflow_status into latest_status
    from public.member_trainings
    where member_id = requested_member
      and training_id = target_training_id
      and archived_at is null
    order by updated_at desc
    limit 1;
    if latest_status = 'cancelled' then
      continue;
    end if;

    insert into public.member_trainings (
      member_id, training_id, status, workflow_status, batch_id, started_at
    ) values (
      requested_member,
      target_training_id,
      'Not Started'::public.training_status,
      case when target_status = 'ongoing' then 'in_progress' else 'pending_enrollment' end,
      p_batch_id,
      case when target_status = 'ongoing' then target_start::timestamptz else null end
    );
    changed_count := changed_count + 1;
    latest_status := null;
  end loop;

  return changed_count;
end;
$$;

-- Repair legacy pending students attached to a class that is already ongoing.
update public.member_trainings enrollment
set workflow_status = 'in_progress',
    started_at = coalesce(enrollment.started_at, batch.starts_on::timestamptz)
from public.training_batches batch
where batch.id = enrollment.batch_id
  and batch.status = 'ongoing'
  and enrollment.archived_at is null
  and enrollment.workflow_status = 'pending_enrollment';

-- Workflow mutations now go through state-aware security-definer functions.
revoke insert, update, delete on public.member_trainings from authenticated;
grant select on public.member_trainings to authenticated;

-- Retire the former individual-start path; class-level Start Class remains the
-- only normal way pending students begin Training.
drop function if exists public.assign_pending_to_training_cycle(uuid, boolean);

revoke all on function public.cancel_training_enrollment(uuid, text) from public, anon;
revoke all on function public.restore_training_enrollment(uuid, uuid, text) from public, anon;
revoke all on function public.withdraw_training_enrollment(uuid, text) from public, anon;
revoke all on function public.reopen_training_enrollment(uuid, text) from public, anon;
grant execute on function public.cancel_training_enrollment(uuid, text) to authenticated;
grant execute on function public.restore_training_enrollment(uuid, uuid, text) to authenticated;
grant execute on function public.withdraw_training_enrollment(uuid, text) to authenticated;
grant execute on function public.reopen_training_enrollment(uuid, text) to authenticated;

commit;
