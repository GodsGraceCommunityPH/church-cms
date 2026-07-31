begin;

-- Retakes require more than one historical member/program row. Replace the
-- global uniqueness rule with uniqueness only while an enrollment is active.
do $$
declare
  constraint_name text;
begin
  select constraint.conname into constraint_name
  from pg_constraint constraint
  where constraint.conrelid = 'public.member_trainings'::regclass
    and constraint.contype = 'u'
    and pg_get_constraintdef(constraint.oid) in (
      'UNIQUE (member_id, training_id)',
      'UNIQUE (training_id, member_id)'
    )
  limit 1;

  if constraint_name is not null then
    execute format(
      'alter table public.member_trainings drop constraint %I',
      constraint_name
    );
  end if;
end;
$$;

create unique index if not exists member_trainings_one_active_program_idx
  on public.member_trainings (member_id, training_id)
  where archived_at is null
    and workflow_status in (
      'pending_enrollment',
      'in_progress',
      'for_remedial',
      'ready_for_completion'
    );

create unique index if not exists training_batches_one_active_cycle_idx
  on public.training_batches (training_id)
  where status in ('open', 'ongoing');

create or replace function public.get_or_create_training_cycle(
  p_training_id uuid
)
returns public.training_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  cycle public.training_batches%rowtype;
  program_name text;
begin
  if not public.has_permission('training.enroll') then
    raise exception 'training.enroll permission required' using errcode = '42501';
  end if;

  select * into cycle
  from public.training_batches
  where training_id = p_training_id
    and status in ('open', 'ongoing')
  order by created_at desc
  limit 1;

  if found then
    return cycle;
  end if;

  select name into program_name
  from public.trainings
  where id = p_training_id;

  if program_name is null then
    raise exception 'Training program not found' using errcode = 'P0002';
  end if;

  begin
    insert into public.training_batches (
      training_id,
      name,
      status,
      starts_on
    ) values (
      p_training_id,
      program_name || ' Training Run - ' || to_char(current_date, 'Mon YYYY'),
      'open',
      current_date
    )
    returning * into cycle;
  exception when unique_violation then
    select * into cycle
    from public.training_batches
    where training_id = p_training_id
      and status in ('open', 'ongoing')
    order by created_at desc
    limit 1;
  end;

  return cycle;
end;
$$;

revoke all on function public.get_or_create_training_cycle(uuid) from public;
revoke all on function public.get_or_create_training_cycle(uuid) from anon;
grant execute on function public.get_or_create_training_cycle(uuid) to authenticated;

create or replace function public.assign_pending_to_training_cycle(
  p_enrollment_id uuid,
  p_start_training boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  enrollment public.member_trainings%rowtype;
  cycle public.training_batches%rowtype;
begin
  if not public.has_permission('training.enroll') then
    raise exception 'training.enroll permission required' using errcode = '42501';
  end if;

  select * into enrollment
  from public.member_trainings
  where id = p_enrollment_id
    and archived_at is null
    and workflow_status = 'pending_enrollment'
  for update;

  if not found then
    raise exception 'Pending enrollment not found' using errcode = 'P0002';
  end if;

  cycle := public.get_or_create_training_cycle(enrollment.training_id);

  update public.member_trainings
  set batch_id = cycle.id,
      workflow_status = case
        when p_start_training then 'in_progress'
        else workflow_status
      end,
      started_at = case
        when p_start_training then coalesce(started_at, now())
        else started_at
      end
  where id = enrollment.id;

  if p_start_training then
    update public.training_batches
    set status = 'ongoing', updated_at = now()
    where id = cycle.id and status = 'open';
  end if;

  return cycle.id;
end;
$$;

revoke all on function public.assign_pending_to_training_cycle(uuid, boolean) from public;
revoke all on function public.assign_pending_to_training_cycle(uuid, boolean) from anon;
grant execute on function public.assign_pending_to_training_cycle(uuid, boolean)
to authenticated;

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
  from unnest(p_member_ids) as candidate(member_id)
  on conflict (member_id, training_id)
    where archived_at is null
      and workflow_status in (
        'pending_enrollment',
        'in_progress',
        'for_remedial',
        'ready_for_completion'
      )
    do nothing;

  get diagnostics enrolled_count = row_count;

  if enrolled_count > 0 then
    update public.training_batches
    set status = 'ongoing', updated_at = now()
    where id = p_batch_id and status = 'open';
  end if;

  return enrolled_count;
end;
$$;

create or replace function public.complete_training_cycle(p_cycle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('training.complete') then
    raise exception 'training.complete permission required' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.member_trainings enrollment
    where enrollment.batch_id = p_cycle_id
      and enrollment.archived_at is null
      and enrollment.workflow_status in (
        'pending_enrollment',
        'in_progress',
        'for_remedial',
        'ready_for_completion'
      )
  ) then
    raise exception 'All students must be completed, withdrawn, or cancelled before completing this Training cycle.'
      using errcode = 'P0001';
  end if;

  update public.training_batches
  set status = 'completed',
      ends_on = coalesce(ends_on, current_date),
      updated_at = now()
  where id = p_cycle_id
    and status in ('open', 'ongoing');

  if not found then
    raise exception 'Active Training cycle not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.complete_training_cycle(uuid) from public;
revoke all on function public.complete_training_cycle(uuid) from anon;
grant execute on function public.complete_training_cycle(uuid) to authenticated;

commit;
