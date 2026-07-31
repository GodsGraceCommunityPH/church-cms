begin;

-- Preserve the source label before normalizing the legacy workflow status.
alter table public.member_trainings
  add column if not exists legacy_status text,
  add column if not exists batch_id uuid,
  add column if not exists started_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.member_trainings
set legacy_status = status
where legacy_status is null
  and status in ('Not Started', 'In Progress', 'Completed');

update public.member_trainings
set status = case status
  when 'Not Started' then 'pending_enrollment'
  when 'In Progress' then 'in_progress'
  when 'Completed' then 'completed'
  else status
end
where status in ('Not Started', 'In Progress', 'Completed');

do $$
begin
  if exists (
    select 1
    from public.member_trainings
    where status not in (
      'pending_enrollment',
      'in_progress',
      'for_remedial',
      'ready_for_completion',
      'completed',
      'withdrawn',
      'cancelled'
    )
  ) then
    raise exception 'Unmapped member_trainings statuses remain; migration stopped.';
  end if;
end;
$$;

alter table public.member_trainings
  drop constraint if exists member_trainings_status_check;
alter table public.member_trainings
  add constraint member_trainings_status_check check (
    status in (
      'pending_enrollment',
      'in_progress',
      'for_remedial',
      'ready_for_completion',
      'completed',
      'withdrawn',
      'cancelled'
    )
  );

create table if not exists public.training_batches (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings(id) on delete restrict,
  name text not null,
  trainer_user_id uuid references public.users(id) on delete set null,
  starts_on date,
  ends_on date,
  status text not null default 'draft'
    check (status in ('draft', 'open', 'ongoing', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (training_id, name)
);

alter table public.member_trainings
  add constraint member_trainings_batch_id_fkey
  foreign key (batch_id) references public.training_batches(id) on delete set null;

create table if not exists public.training_requirements (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings(id) on delete restrict,
  name text not null,
  description text,
  requirement_type text not null default 'assignment'
    check (requirement_type in ('assignment', 'attendance', 'assessment', 'other')),
  display_order integer not null default 0,
  is_required boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (training_id, name)
);

create table if not exists public.member_training_requirements (
  id uuid primary key default gen_random_uuid(),
  member_training_id uuid not null references public.member_trainings(id) on delete restrict,
  requirement_id uuid not null references public.training_requirements(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'complete', 'missing', 'for_remedial')),
  completed_at timestamptz,
  attendance_status text
    check (attendance_status is null or attendance_status in ('present', 'late', 'excused', 'absent')),
  notes text,
  remedial_required boolean not null default false,
  remedial_date date,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_training_id, requirement_id)
);

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.training_batches(id) on delete restrict,
  title text not null,
  session_date timestamptz,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, title)
);

create table if not exists public.training_attendance (
  id uuid primary key default gen_random_uuid(),
  member_training_id uuid not null references public.member_trainings(id) on delete restrict,
  session_id uuid not null references public.training_sessions(id) on delete restrict,
  status text not null check (status in ('present', 'late', 'excused', 'absent')),
  notes text,
  recorded_by uuid not null default auth.uid() references public.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_training_id, session_id)
);

create table if not exists public.training_notes (
  id uuid primary key default gen_random_uuid(),
  member_training_id uuid not null references public.member_trainings(id) on delete restrict,
  note text not null,
  created_by uuid not null default auth.uid() references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_remedials (
  id uuid primary key default gen_random_uuid(),
  member_training_id uuid not null references public.member_trainings(id) on delete restrict,
  requirement_id uuid references public.training_requirements(id) on delete set null,
  scheduled_for date not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled')),
  notes text,
  created_by uuid not null default auth.uid() references public.users(id) on delete restrict,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_advancement_eligibility (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  source_member_training_id uuid not null references public.member_trainings(id) on delete restrict,
  next_training_id uuid not null references public.trainings(id) on delete restrict,
  status text not null default 'eligible'
    check (status in ('eligible', 'recommended', 'deferred', 'enrolled', 'declined')),
  recommendation text,
  recommended_by uuid not null default auth.uid() references public.users(id) on delete restrict,
  recommended_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_member_training_id, next_training_id)
);

create table if not exists public.member_training_status_history (
  id uuid primary key default gen_random_uuid(),
  member_training_id uuid not null references public.member_trainings(id) on delete restrict,
  previous_status text,
  new_status text not null,
  changed_by uuid references public.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create or replace function public.record_member_training_status_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    insert into public.member_training_status_history (
      member_training_id,
      previous_status,
      new_status,
      changed_by
    ) values (new.id, old.status, new.status, auth.uid());
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists member_training_status_audit on public.member_trainings;
create trigger member_training_status_audit
before update on public.member_trainings
for each row execute procedure public.record_member_training_status_change();

-- The approved Trainer role remains attendance-only.
delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.code = 'trainer'
  and p.code in ('training.enroll', 'training.recommend', 'training.complete');

alter table public.training_batches enable row level security;
alter table public.training_requirements enable row level security;
alter table public.member_training_requirements enable row level security;
alter table public.training_sessions enable row level security;
alter table public.training_attendance enable row level security;
alter table public.training_notes enable row level security;
alter table public.training_remedials enable row level security;
alter table public.training_advancement_eligibility enable row level security;
alter table public.member_training_status_history enable row level security;

revoke all on table
  public.training_batches,
  public.training_requirements,
  public.member_training_requirements,
  public.training_sessions,
  public.training_attendance,
  public.training_notes,
  public.training_remedials,
  public.training_advancement_eligibility,
  public.member_training_status_history
from anon;

revoke delete on public.member_trainings from authenticated;
grant select, insert, update on public.member_trainings to authenticated;
grant select, insert, update on
  public.training_batches,
  public.training_requirements,
  public.member_training_requirements,
  public.training_sessions,
  public.training_notes,
  public.training_remedials
to authenticated;
grant select, insert, update on public.training_attendance to authenticated;
grant select, insert, update on public.training_advancement_eligibility to authenticated;
grant select, insert on public.member_training_status_history to authenticated;

create policy "Training viewers read batches" on public.training_batches
for select to authenticated using (public.has_permission('training.view'));
create policy "Enrollment managers manage batches" on public.training_batches
for all to authenticated using (public.has_permission('training.enroll'))
with check (public.has_permission('training.enroll'));

create policy "Training viewers read requirements" on public.training_requirements
for select to authenticated using (public.has_permission('training.view'));
create policy "Enrollment managers manage requirements" on public.training_requirements
for all to authenticated using (public.has_permission('training.enroll'))
with check (public.has_permission('training.enroll'));

create policy "Training viewers read member requirement progress"
on public.member_training_requirements
for select to authenticated using (public.has_permission('training.view'));
create policy "Enrollment managers manage member requirement progress"
on public.member_training_requirements
for all to authenticated using (public.has_permission('training.enroll'))
with check (public.has_permission('training.enroll'));

create policy "Training viewers read sessions" on public.training_sessions
for select to authenticated using (public.has_permission('training.view'));
create policy "Enrollment managers manage sessions" on public.training_sessions
for all to authenticated using (public.has_permission('training.enroll'))
with check (public.has_permission('training.enroll'));

create policy "Training viewers read attendance" on public.training_attendance
for select to authenticated using (public.has_permission('training.view'));
create policy "Attendance recorders manage attendance" on public.training_attendance
for all to authenticated using (public.has_permission('training.attendance'))
with check (public.has_permission('training.attendance'));

create policy "Training viewers read notes" on public.training_notes
for select to authenticated using (public.has_permission('training.view'));
create policy "Enrollment managers manage notes" on public.training_notes
for all to authenticated using (public.has_permission('training.enroll'))
with check (public.has_permission('training.enroll'));

create policy "Training viewers read remedials" on public.training_remedials
for select to authenticated using (public.has_permission('training.view'));
create policy "Enrollment managers manage remedials" on public.training_remedials
for all to authenticated using (public.has_permission('training.enroll'))
with check (public.has_permission('training.enroll'));

create policy "Training viewers read advancement eligibility"
on public.training_advancement_eligibility
for select to authenticated using (public.has_permission('training.view'));
create policy "Recommenders manage advancement eligibility"
on public.training_advancement_eligibility
for all to authenticated using (public.has_permission('training.recommend'))
with check (public.has_permission('training.recommend'));

create policy "Training viewers read status history"
on public.member_training_status_history
for select to authenticated using (public.has_permission('training.view'));
create policy "Enrollment managers record status history"
on public.member_training_status_history
for insert to authenticated with check (public.has_permission('training.enroll'));

create policy "Training viewers read associated portal users" on public.users
for select to authenticated using (
  id = auth.uid()
  or (
    public.has_permission('training.view')
    and (
      exists (
        select 1 from public.training_batches b
        where b.trainer_user_id = users.id
      )
      or exists (
        select 1 from public.training_notes n
        where n.created_by = users.id
      )
    )
  )
);
create policy "User administrators read portal users" on public.users
for select to authenticated using (public.has_permission('admin.users'));
create policy "User administrators read role assignments" on public.user_roles
for select to authenticated using (public.has_permission('admin.users'));

create or replace function public.complete_training_enrollment(
  p_enrollment_id uuid,
  p_next_training_id uuid default null,
  p_recommendation_text text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  enrollment public.member_trainings%rowtype;
begin
  if not public.has_permission('training.complete') then
    raise exception 'training.complete permission required' using errcode = '42501';
  end if;

  if p_next_training_id is not null
     and not public.has_permission('training.recommend') then
    raise exception 'training.recommend permission required' using errcode = '42501';
  end if;

  select * into enrollment
  from public.member_trainings mt
  where mt.id = p_enrollment_id
  for update;

  if not found then
    raise exception 'Training enrollment not found' using errcode = 'P0002';
  end if;

  update public.member_trainings
  set status = 'completed',
      completed_at = coalesce(completed_at, now())
  where id = p_enrollment_id;

  if p_next_training_id is not null then
    insert into public.training_advancement_eligibility (
      member_id,
      source_member_training_id,
      p_next_training_id,
      status,
      recommendation
    ) values (
      enrollment.member_id,
      enrollment.id,
      next_training_id,
      'recommended',
      p_recommendation_text
    )
    on conflict (source_member_training_id, next_training_id)
    do update set
      status = 'recommended',
      recommendation = excluded.recommendation,
      recommended_by = auth.uid(),
      recommended_at = now(),
      updated_at = now();
  end if;
end;
$$;

revoke all on function public.complete_training_enrollment(uuid, uuid, text) from public;
revoke all on function public.complete_training_enrollment(uuid, uuid, text) from anon;
grant execute on function public.complete_training_enrollment(uuid, uuid, text)
to authenticated;

commit;
