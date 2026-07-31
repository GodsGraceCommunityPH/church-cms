begin;

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
  enrolled_count integer;
begin
  if not public.has_permission('training.enroll') then
    raise exception 'training.enroll permission required' using errcode = '42501';
  end if;

  select batch.training_id into target_training_id
  from public.training_batches batch
  where batch.id = p_batch_id
    and batch.status in ('open', 'ongoing');

  if target_training_id is null then
    raise exception 'Active Training cycle not found' using errcode = 'P0002';
  end if;

  insert into public.member_trainings (
    member_id,
    training_id,
    status,
    workflow_status,
    batch_id,
    started_at
  )
  select
    candidate.member_id,
    target_training_id,
    'Not Started'::public.training_status,
    'pending_enrollment',
    p_batch_id,
    null
  from (
    select distinct member_id
    from unnest(p_member_ids) as requested(member_id)
  ) candidate
  where not exists (
    select 1
    from public.member_trainings existing
    where existing.member_id = candidate.member_id
      and existing.training_id = target_training_id
      and existing.archived_at is null
      and existing.workflow_status in (
        'pending_enrollment',
        'in_progress',
        'for_remedial',
        'ready_for_completion'
      )
  )
  on conflict do nothing;

  get diagnostics enrolled_count = row_count;

  if enrolled_count > 0 then
    update public.training_batches
    set status = 'ongoing', updated_at = now()
    where id = p_batch_id and status = 'open';
  end if;

  return enrolled_count;
end;
$$;

revoke all on function public.enroll_training_batch_students(uuid, uuid[]) from public;
revoke all on function public.enroll_training_batch_students(uuid, uuid[]) from anon;
grant execute on function public.enroll_training_batch_students(uuid, uuid[]) to authenticated;

commit;
