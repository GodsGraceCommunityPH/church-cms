begin;

alter table public.member_trainings
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.users(id) on delete set null,
  add column if not exists archive_reason text;

create index if not exists member_trainings_operational_idx
  on public.member_trainings (training_id, workflow_status)
  where archived_at is null;

create or replace function public.archive_imported_training_enrollments()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  archived_count integer;
begin
  if not public.has_permission('admin.settings') then
    raise exception 'Administrator permission required' using errcode = '42501';
  end if;

  update public.member_trainings
  set archived_at = now(),
      archived_by = auth.uid(),
      archive_reason = 'Archived imported Training data for operational reset'
  where legacy_status is not null
    and archived_at is null;

  get diagnostics archived_count = row_count;
  return archived_count;
end;
$$;

revoke all on function public.archive_imported_training_enrollments() from public;
revoke all on function public.archive_imported_training_enrollments() from anon;
grant execute on function public.archive_imported_training_enrollments()
to authenticated;

create or replace function public.create_member_training_checklist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.member_training_requirements (
    member_training_id,
    requirement_id
  )
  select new.id, requirement.id
  from public.training_requirements requirement
  where requirement.training_id = new.training_id
    and requirement.is_active
  on conflict (member_training_id, requirement_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_member_training_checklist
on public.member_trainings;
create trigger create_member_training_checklist
after insert on public.member_trainings
for each row execute procedure public.create_member_training_checklist();

create or replace function public.propagate_training_requirement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active then
    insert into public.member_training_requirements (
      member_training_id,
      requirement_id
    )
    select enrollment.id, new.id
    from public.member_trainings enrollment
    where enrollment.training_id = new.training_id
      and enrollment.archived_at is null
    on conflict (member_training_id, requirement_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists propagate_training_requirement
on public.training_requirements;
create trigger propagate_training_requirement
after insert or update of is_active on public.training_requirements
for each row execute procedure public.propagate_training_requirement();

create or replace function public.ready_when_requirements_complete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  incomplete_count integer;
begin
  if new.status <> 'complete' then
    return new;
  end if;

  select count(*) into incomplete_count
  from public.member_training_requirements progress
  join public.training_requirements requirement
    on requirement.id = progress.requirement_id
  where progress.member_training_id = new.member_training_id
    and requirement.is_active
    and requirement.is_required
    and progress.status <> 'complete';

  if incomplete_count = 0 then
    update public.member_trainings
    set workflow_status = 'ready_for_completion'
    where id = new.member_training_id
      and workflow_status in ('in_progress', 'for_remedial');
  end if;
  return new;
end;
$$;

drop trigger if exists ready_when_requirements_complete
on public.member_training_requirements;
create trigger ready_when_requirements_complete
after insert or update of status on public.member_training_requirements
for each row execute procedure public.ready_when_requirements_complete();

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
  where not exists (
    select 1
    from public.member_trainings existing
    where existing.member_id = candidate.member_id
      and existing.training_id = target_training_id
      and existing.archived_at is null
      and existing.workflow_status not in ('withdrawn', 'cancelled')
  );

  get diagnostics enrolled_count = row_count;
  return enrolled_count;
end;
$$;

revoke all on function public.enroll_training_batch_students(uuid, uuid[]) from public;
revoke all on function public.enroll_training_batch_students(uuid, uuid[]) from anon;
grant execute on function public.enroll_training_batch_students(uuid, uuid[])
to authenticated;

commit;
