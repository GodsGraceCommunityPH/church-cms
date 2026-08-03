begin;

alter table public.member_trainings
  add column if not exists cell_group_id_at_enrollment uuid references public.cell_groups(id) on delete set null,
  add column if not exists cell_leader_member_id_at_enrollment uuid references public.members(id) on delete set null;

create table if not exists public.member_training_guide_assignments (
  id uuid primary key default gen_random_uuid(),
  member_training_id uuid not null references public.member_trainings(id) on delete restrict,
  guide_member_id uuid not null references public.members(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  assigned_by uuid references public.users(id) on delete set null default auth.uid(),
  change_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guide_assignment_dates_valid check (ended_at is null or ended_at >= assigned_at)
);

create unique index if not exists member_training_one_active_guide_idx
  on public.member_training_guide_assignments(member_training_id)
  where ended_at is null;
create index if not exists member_training_guide_history_idx
  on public.member_training_guide_assignments(member_training_id, assigned_at desc);

create table if not exists public.training_program_requirements (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings(id) on delete restrict,
  name text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_requirement_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists training_program_active_requirement_name_idx
  on public.training_program_requirements(training_id, lower(btrim(name)))
  where is_active;
create index if not exists training_program_requirement_order_idx
  on public.training_program_requirements(training_id, display_order, created_at);

create table if not exists public.member_training_session_requirement_progress (
  id uuid primary key default gen_random_uuid(),
  member_training_id uuid not null references public.member_trainings(id) on delete restrict,
  training_session_id uuid not null references public.training_sessions(id) on delete restrict,
  program_requirement_id uuid not null references public.training_program_requirements(id) on delete restrict,
  completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references public.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(member_training_id, training_session_id, program_requirement_id),
  constraint requirement_completion_metadata_valid check (
    (completed and completed_at is not null) or
    (not completed and completed_at is null)
  )
);

create index if not exists member_training_requirement_progress_idx
  on public.member_training_session_requirement_progress(member_training_id, training_session_id);

alter table public.member_training_guide_assignments enable row level security;
alter table public.training_program_requirements enable row level security;
alter table public.member_training_session_requirement_progress enable row level security;

revoke all on public.member_training_guide_assignments,
  public.training_program_requirements,
  public.member_training_session_requirement_progress from public, anon, authenticated;
grant select on public.member_training_guide_assignments,
  public.training_program_requirements,
  public.member_training_session_requirement_progress to authenticated;

drop policy if exists "Training viewers read guide history" on public.member_training_guide_assignments;
create policy "Training viewers read guide history"
on public.member_training_guide_assignments for select to authenticated
using (public.has_permission('training.view'));

drop policy if exists "Training viewers read program requirements" on public.training_program_requirements;
create policy "Training viewers read program requirements"
on public.training_program_requirements for select to authenticated
using (public.has_permission('training.view'));

drop policy if exists "Training viewers read session requirement progress" on public.member_training_session_requirement_progress;
create policy "Training viewers read session requirement progress"
on public.member_training_session_requirement_progress for select to authenticated
using (public.has_permission('training.view'));

create or replace function public.enroll_training_batch_students_with_guides(
  p_batch_id uuid,
  p_assignments jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_training_id uuid;
  target_training_name text;
  guide_required boolean;
  target_status text;
  target_start date;
  assignment jsonb;
  requested_member uuid;
  requested_guide uuid;
  member_cell_group uuid;
  member_cell_leader uuid;
  enrollment_id uuid;
  latest_status text;
  changed_count integer := 0;
begin
  if not public.has_permission('training.enroll') then
    raise exception 'training.enroll permission required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_assignments) <> 'array' or jsonb_array_length(p_assignments) = 0 then
    raise exception 'At least one student and Guide are required' using errcode = '22023';
  end if;

  select batch.training_id, training.name, batch.status, batch.starts_on
    into target_training_id, target_training_name, target_status, target_start
  from public.training_batches batch
  join public.trainings training on training.id = batch.training_id
  where batch.id = p_batch_id and batch.status in ('open', 'ongoing')
  for update of batch;

  if target_training_id is null then
    raise exception 'Active Current Class not found' using errcode = 'P0002';
  end if;
  guide_required := lower(regexp_replace(target_training_name, '[^a-z0-9]', '', 'g')) in ('suynl', 'lifeclass');

  for assignment in select value from jsonb_array_elements(p_assignments) loop
    requested_member := nullif(assignment->>'member_id', '')::uuid;
    requested_guide := nullif(assignment->>'guide_member_id', '')::uuid;
    if requested_member is null or (guide_required and requested_guide is null) then
      raise exception 'Every student must have a Guide' using errcode = '22023';
    end if;
    if requested_guide is not null and requested_member = requested_guide then
      raise exception 'A student cannot be their own Guide' using errcode = '22023';
    end if;
    if not exists (select 1 from public.members where id = requested_member)
       or (requested_guide is not null and not exists (select 1 from public.members where id = requested_guide)) then
      raise exception 'Student or Guide member not found' using errcode = 'P0002';
    end if;
    if exists (
      select 1 from public.member_trainings
      where member_id = requested_member and training_id = target_training_id
        and archived_at is null
        and workflow_status in ('pending_enrollment','in_progress','for_remedial','ready_for_completion')
    ) then
      continue;
    end if;
    select workflow_status into latest_status
    from public.member_trainings
    where member_id = requested_member and training_id = target_training_id and archived_at is null
    order by updated_at desc limit 1;
    if latest_status = 'cancelled' then
      continue;
    end if;

    select member.cell_group_id, cell_group.leader_id
      into member_cell_group, member_cell_leader
    from public.members member
    left join public.cell_groups cell_group on cell_group.id = member.cell_group_id
    where member.id = requested_member;

    insert into public.member_trainings (
      member_id, training_id, status, workflow_status, batch_id, started_at,
      cell_group_id_at_enrollment, cell_leader_member_id_at_enrollment
    ) values (
      requested_member, target_training_id, 'Not Started'::public.training_status,
      case when target_status = 'ongoing' then 'in_progress' else 'pending_enrollment' end,
      p_batch_id, case when target_status = 'ongoing' then target_start::timestamptz else null end,
      member_cell_group, member_cell_leader
    ) returning id into enrollment_id;

    if requested_guide is not null then
      insert into public.member_training_guide_assignments(
        member_training_id, guide_member_id, assigned_by
      ) values (enrollment_id, requested_guide, auth.uid());
    end if;
    changed_count := changed_count + 1;
    latest_status := null;
  end loop;
  return changed_count;
end;
$$;

create or replace function public.change_training_guide(
  p_member_training_id uuid,
  p_guide_member_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  enrollment_member uuid;
  enrollment_status text;
  current_guide uuid;
  new_assignment_id uuid;
begin
  if not public.has_permission('training.enroll') then
    raise exception 'training.enroll permission required' using errcode = '42501';
  end if;
  select member_id, workflow_status into enrollment_member, enrollment_status
  from public.member_trainings where id = p_member_training_id and archived_at is null for update;
  if enrollment_member is null then raise exception 'Training enrollment not found' using errcode = 'P0002'; end if;
  if enrollment_status not in ('pending_enrollment','in_progress','for_remedial','ready_for_completion') then
    raise exception 'Guide can only be changed for an active enrollment' using errcode = 'P0001';
  end if;
  if p_guide_member_id = enrollment_member then raise exception 'A student cannot be their own Guide' using errcode = '22023'; end if;
  if not exists(select 1 from public.members where id = p_guide_member_id) then raise exception 'Guide member not found' using errcode = 'P0002'; end if;
  select guide_member_id into current_guide from public.member_training_guide_assignments
    where member_training_id = p_member_training_id and ended_at is null for update;
  if current_guide = p_guide_member_id then return (
    select id from public.member_training_guide_assignments where member_training_id=p_member_training_id and ended_at is null
  ); end if;
  update public.member_training_guide_assignments set ended_at=now(), updated_at=now(), change_reason=nullif(btrim(p_reason),'')
    where member_training_id=p_member_training_id and ended_at is null;
  insert into public.member_training_guide_assignments(member_training_id,guide_member_id,assigned_by,change_reason)
    values(p_member_training_id,p_guide_member_id,auth.uid(),nullif(btrim(p_reason),'')) returning id into new_assignment_id;
  return new_assignment_id;
end;
$$;

create or replace function public.save_training_program_requirement(
  p_training_id uuid,
  p_name text,
  p_requirement_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare result_id uuid;
begin
  if not public.has_permission('training.enroll') then raise exception 'training.enroll permission required' using errcode='42501'; end if;
  if btrim(coalesce(p_name,'')) = '' then raise exception 'Requirement name is required' using errcode='22023'; end if;
  if p_requirement_id is null then
    insert into public.training_program_requirements(training_id,name,display_order)
      values(p_training_id,btrim(p_name),coalesce((select max(display_order)+1 from public.training_program_requirements where training_id=p_training_id),0))
      returning id into result_id;
  else
    update public.training_program_requirements set name=btrim(p_name),updated_at=now()
      where id=p_requirement_id and training_id=p_training_id returning id into result_id;
    if result_id is null then raise exception 'Program requirement not found' using errcode='P0002'; end if;
  end if;
  return result_id;
end;
$$;

create or replace function public.set_training_program_requirement_active(p_requirement_id uuid,p_is_active boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.has_permission('training.enroll') then raise exception 'training.enroll permission required' using errcode='42501'; end if;
  update public.training_program_requirements set is_active=p_is_active,updated_at=now() where id=p_requirement_id;
  if not found then raise exception 'Program requirement not found' using errcode='P0002'; end if;
end; $$;

create or replace function public.record_training_session_requirement(
  p_enrollment_id uuid,
  p_session_id uuid,
  p_requirement_id uuid,
  p_completed boolean
)
returns void language plpgsql security definer set search_path='' as $$
declare enrollment_batch uuid; enrollment_training uuid; session_batch uuid; current_session uuid; requirement_training uuid;
begin
  if not public.has_permission('training.attendance') then raise exception 'training.attendance permission required' using errcode='42501'; end if;
  select batch_id,training_id into enrollment_batch,enrollment_training from public.member_trainings
    where id=p_enrollment_id and archived_at is null and workflow_status in ('in_progress','for_remedial','ready_for_completion');
  select batch_id into session_batch from public.training_sessions where id=p_session_id;
  select training_id into requirement_training from public.training_program_requirements where id=p_requirement_id and is_active;
  current_session := public.get_current_training_session(enrollment_batch);
  if enrollment_batch is null or session_batch is distinct from enrollment_batch or requirement_training is distinct from enrollment_training then
    raise exception 'Enrollment, session, and requirement do not belong together' using errcode='P0001';
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
end; $$;

revoke all on function public.enroll_training_batch_students_with_guides(uuid,jsonb),
  public.change_training_guide(uuid,uuid,text),
  public.save_training_program_requirement(uuid,text,uuid),
  public.set_training_program_requirement_active(uuid,boolean),
  public.record_training_session_requirement(uuid,uuid,uuid,boolean) from public, anon;
grant execute on function public.enroll_training_batch_students_with_guides(uuid,jsonb),
  public.change_training_guide(uuid,uuid,text),
  public.save_training_program_requirement(uuid,text,uuid),
  public.set_training_program_requirement_active(uuid,boolean),
  public.record_training_session_requirement(uuid,uuid,uuid,boolean) to authenticated;

commit;
