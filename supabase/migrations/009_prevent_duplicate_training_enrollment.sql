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
  where batch.id = p_batch_id;

  if target_training_id is null then
    raise exception 'Training batch not found' using errcode = 'P0002';
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
  from unnest(p_member_ids) as candidate(member_id)
  on conflict (member_id, training_id) do nothing;

  get diagnostics enrolled_count = row_count;
  return enrolled_count;
end;
$$;

revoke all on function public.enroll_training_batch_students(uuid, uuid[]) from public;
revoke all on function public.enroll_training_batch_students(uuid, uuid[]) from anon;
grant execute on function public.enroll_training_batch_students(uuid, uuid[])
to authenticated;

commit;
