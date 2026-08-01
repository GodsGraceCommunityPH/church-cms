begin;

alter table public.training_sessions
  add column if not exists attendance_reopened_at timestamptz,
  add column if not exists attendance_reopened_by uuid
    references public.users(id) on delete set null;

create table if not exists public.training_session_edit_history (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete restrict,
  action text not null check (action in ('reopened', 'closed')),
  acted_by uuid not null default auth.uid() references public.users(id) on delete restrict,
  acted_at timestamptz not null default now(),
  reason text
);

alter table public.training_session_edit_history enable row level security;
revoke all on public.training_session_edit_history from anon, authenticated;
grant select on public.training_session_edit_history to authenticated;
drop policy if exists "Training viewers read session edit history"
  on public.training_session_edit_history;
create policy "Training viewers read session edit history"
on public.training_session_edit_history
for select to authenticated using (public.has_permission('training.view'));

create or replace function public.get_current_training_session(p_batch_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_session_id uuid;
begin
  select session.id into current_session_id
  from public.training_sessions session
  join public.training_batches batch on batch.id = session.batch_id
  where session.batch_id = p_batch_id
    and session.display_order between 1 and batch.required_sessions
    and (
      not exists (
        select 1
        from public.member_trainings enrollment
        where enrollment.batch_id = batch.id
          and enrollment.archived_at is null
          and enrollment.workflow_status in (
            'in_progress', 'for_remedial', 'ready_for_completion'
          )
      )
      or exists (
        select 1
        from public.member_trainings enrollment
        where enrollment.batch_id = batch.id
          and enrollment.archived_at is null
          and enrollment.workflow_status in (
            'in_progress', 'for_remedial', 'ready_for_completion'
          )
          and not exists (
            select 1
            from public.training_attendance attendance
            where attendance.member_training_id = enrollment.id
              and attendance.session_id = session.id
          )
      )
    )
  order by session.display_order
  limit 1;

  return current_session_id;
end;
$$;

create or replace function public.record_training_attendance(
  p_enrollment_id uuid,
  p_session_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  enrollment public.member_trainings%rowtype;
  batch_status text;
  session_batch_id uuid;
  session_order integer;
  reopened_at timestamptz;
  current_session_id uuid;
  current_order integer;
begin
  if not public.has_permission('training.attendance') then
    raise exception 'training.attendance permission required' using errcode = '42501';
  end if;
  if p_status not in ('present', 'late', 'absent', 'excused') then
    raise exception 'Invalid attendance status' using errcode = '22023';
  end if;

  select * into enrollment
  from public.member_trainings
  where id = p_enrollment_id
  for update;

  if not found or enrollment.archived_at is not null then
    raise exception 'Active Training enrollment not found' using errcode = 'P0002';
  end if;
  if enrollment.workflow_status not in (
    'in_progress', 'for_remedial', 'ready_for_completion'
  ) then
    raise exception 'Attendance can only be recorded for an active student' using errcode = 'P0001';
  end if;

  select batch.status into batch_status
  from public.training_batches batch
  where batch.id = enrollment.batch_id;

  select session.batch_id, session.display_order, session.attendance_reopened_at
    into session_batch_id, session_order, reopened_at
  from public.training_sessions session
  join public.training_batches batch on batch.id = session.batch_id
  where session.id = p_session_id
    and session.display_order between 1 and batch.required_sessions;

  if batch_status <> 'ongoing' then
    raise exception 'Attendance can only be recorded after the class starts' using errcode = 'P0001';
  end if;
  if session_batch_id is null or session_batch_id <> enrollment.batch_id then
    raise exception 'This session does not belong to the student''s Current Class' using errcode = 'P0001';
  end if;

  current_session_id := public.get_current_training_session(enrollment.batch_id);
  select display_order into current_order
  from public.training_sessions
  where id = current_session_id;

  if p_session_id is distinct from current_session_id and reopened_at is null then
    if current_order is not null and session_order > current_order then
      raise exception 'This future session is not available yet' using errcode = 'P0001';
    end if;
    raise exception 'This completed session is read-only. An Administrator must reopen it for editing.' using errcode = 'P0001';
  end if;

  insert into public.training_attendance (
    member_training_id, session_id, status
  ) values (
    p_enrollment_id, p_session_id, p_status
  )
  on conflict (member_training_id, session_id)
  do update set
    status = excluded.status,
    recorded_by = auth.uid(),
    recorded_at = now(),
    updated_at = now();

  perform public.recalculate_training_eligibility(p_enrollment_id);
end;
$$;

create or replace function public.reopen_training_session(
  p_session_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_batch_id uuid;
  target_order integer;
  current_order integer;
begin
  if not public.has_permission('admin.settings') then
    raise exception 'Administrator permission required' using errcode = '42501';
  end if;

  select session.batch_id, session.display_order
    into target_batch_id, target_order
  from public.training_sessions session
  join public.training_batches batch on batch.id = session.batch_id
  where session.id = p_session_id
    and batch.status = 'ongoing'
  for update of session;

  if target_batch_id is null then
    raise exception 'Ongoing class session not found' using errcode = 'P0002';
  end if;

  select display_order into current_order
  from public.training_sessions
  where id = public.get_current_training_session(target_batch_id);

  if current_order is null or target_order >= current_order then
    raise exception 'Only a completed previous session can be reopened' using errcode = 'P0001';
  end if;

  update public.training_sessions
  set attendance_reopened_at = now(), attendance_reopened_by = auth.uid(), updated_at = now()
  where id = p_session_id;

  insert into public.training_session_edit_history (session_id, action, reason)
  values (p_session_id, 'reopened', nullif(trim(p_reason), ''));
end;
$$;

create or replace function public.close_training_session_editing(
  p_session_id uuid,
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

  update public.training_sessions
  set attendance_reopened_at = null, attendance_reopened_by = null, updated_at = now()
  where id = p_session_id
    and attendance_reopened_at is not null;

  if not found then
    raise exception 'Reopened session not found' using errcode = 'P0002';
  end if;

  insert into public.training_session_edit_history (session_id, action, reason)
  values (p_session_id, 'closed', nullif(trim(p_reason), ''));
end;
$$;

create or replace function public.create_training_cycle(
  p_training_id uuid,
  p_start_date date,
  p_required_sessions integer default 10,
  p_cadence_days integer default 7
)
returns public.training_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  cycle public.training_batches%rowtype;
  program_name text;
  session_number integer;
begin
  if not public.has_permission('training.enroll') then
    raise exception 'training.enroll permission required' using errcode = '42501';
  end if;
  if p_start_date is null or p_required_sessions < 1 or p_cadence_days < 1 then
    raise exception 'Valid class date, required sessions, and cadence are required' using errcode = '22023';
  end if;
  if extract(isodow from p_start_date) <> 7 then
    raise exception 'Class Start Date must be a Sunday' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.training_batches
    where training_id = p_training_id and status in ('open', 'ongoing')
  ) then
    raise exception 'This program already has a Current Class' using errcode = 'P0001';
  end if;

  select name into program_name from public.trainings where id = p_training_id;
  if program_name is null then
    raise exception 'Training program not found' using errcode = 'P0002';
  end if;

  insert into public.training_batches (
    training_id, name, status, starts_on, required_sessions, cadence_days
  ) values (
    p_training_id,
    program_name || ' Class - ' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS-MS'),
    'open', p_start_date, p_required_sessions, p_cadence_days
  ) returning * into cycle;

  insert into public.training_completion_checklist (
    batch_id, requirement_key, label, configuration
  ) values (
    cycle.id, 'required_attendance', 'Required attendance completed',
    jsonb_build_object('required_sessions', p_required_sessions)
  );

  for session_number in 1..p_required_sessions loop
    insert into public.training_sessions (
      batch_id, title, session_date, display_order
    ) values (
      cycle.id,
      'Week ' || session_number,
      (p_start_date + ((session_number - 1) * p_cadence_days))::timestamptz,
      session_number
    );
  end loop;

  return cycle;
end;
$$;

-- Attendance mutations must use the guarded RPC; direct browser writes would
-- otherwise bypass sequential release and current-class validation.
drop policy if exists "Attendance recorders manage attendance"
  on public.training_attendance;
revoke insert, update, delete on public.training_attendance from authenticated;
grant select on public.training_attendance to authenticated;

revoke all on function public.get_current_training_session(uuid) from public, anon;
revoke all on function public.record_training_attendance(uuid, uuid, text) from public, anon;
revoke all on function public.reopen_training_session(uuid, text) from public, anon;
revoke all on function public.close_training_session_editing(uuid, text) from public, anon;
grant execute on function public.record_training_attendance(uuid, uuid, text) to authenticated;
grant execute on function public.reopen_training_session(uuid, text) to authenticated;
grant execute on function public.close_training_session_editing(uuid, text) to authenticated;

commit;
