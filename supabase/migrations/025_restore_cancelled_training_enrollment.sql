begin;

drop function if exists public.restore_training_enrollment(uuid, uuid, text);
create or replace function public.restore_training_enrollment(
  p_enrollment_id uuid,
  p_batch_id uuid,
  p_reason text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_training_id uuid;
  target_status text;
  target_start date;
  enrollment_training_id uuid;
  enrollment_member_id uuid;
  restored_status text;
begin
  if not public.has_permission('admin.settings') then
    raise exception 'Administrator permission required' using errcode = '42501';
  end if;

  select training_id, status, starts_on
    into target_training_id, target_status, target_start
  from public.training_batches
  where id = p_batch_id
    and status in ('open', 'ongoing')
    and archived_at is null
  for update;

  if target_training_id is null then
    raise exception 'A Current Class is required to restore this enrollment'
      using errcode = 'P0001';
  end if;

  select training_id, member_id
    into enrollment_training_id, enrollment_member_id
  from public.member_trainings
  where id = p_enrollment_id
    and archived_at is null
    and workflow_status = 'cancelled'
  for update;

  if enrollment_training_id is null then
    raise exception 'Cancelled enrollment not found' using errcode = 'P0002';
  end if;
  if enrollment_training_id <> target_training_id then
    raise exception 'Cancelled enrollment belongs to a different Training program'
      using errcode = 'P0001';
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
    raise exception 'Member already has an active enrollment in this program'
      using errcode = '23505';
  end if;

  restored_status := case
    when target_status = 'ongoing' then 'in_progress'
    else 'pending_enrollment'
  end;

  perform set_config('app.training_transition_reason', coalesce(p_reason, ''), true);
  update public.member_trainings
  set batch_id = p_batch_id,
      workflow_status = restored_status,
      started_at = case
        when target_status = 'ongoing' then coalesce(started_at, target_start::timestamptz)
        else null
      end,
      completed_at = null,
      cancelled_at = null,
      withdrawn_at = null
  where id = p_enrollment_id;

  return restored_status;
end;
$$;

-- Both valid restore destinations must be recorded as a restore event.
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
      when old.workflow_status = 'cancelled' and new.workflow_status in ('pending_enrollment', 'in_progress') then 'restored'
      when old.workflow_status = 'in_progress' and new.workflow_status = 'withdrawn' then 'withdrawn'
      when old.workflow_status = 'completed' and new.workflow_status = 'in_progress' then 'reopened'
      when new.workflow_status = 'completed' then 'completed'
      when new.workflow_status = 'ready_for_completion' then 'became_eligible'
      when old.workflow_status = 'ready_for_completion' then 'eligibility_removed'
      else 'status_changed'
    end;

    insert into public.member_training_status_history (
      member_training_id, previous_status, new_status, changed_by
    ) values (new.id, old.workflow_status, new.workflow_status, auth.uid());

    insert into public.member_training_workflow_events (
      member_training_id, event_type, previous_status, new_status,
      previous_batch_id, new_batch_id, previous_completed_at,
      new_completed_at, reason, acted_by, snapshot
    ) values (
      new.id, transition_event, old.workflow_status, new.workflow_status,
      old.batch_id, new.batch_id, old.completed_at, new.completed_at,
      transition_reason, auth.uid(),
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

revoke all on function public.restore_training_enrollment(uuid, uuid, text)
  from public, anon;
grant execute on function public.restore_training_enrollment(uuid, uuid, text)
  to authenticated;

-- The RPC is dropped and recreated with a text return value, so explicitly
-- refresh PostgREST's function metadata after the transaction commits.
notify pgrst, 'reload schema';

commit;
