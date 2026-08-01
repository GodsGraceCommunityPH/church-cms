begin;

-- Historical classes are hidden through archival, never by deleting their
-- enrollments, attendance, remedials, notes, or workflow events.
alter table public.training_batches
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.users(id) on delete set null;

create table if not exists public.training_session_schedule_history (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete restrict,
  previous_date timestamptz,
  new_date timestamptz,
  shifted_succeeding boolean not null default false,
  reason text,
  acted_by uuid references public.users(id) on delete set null default auth.uid(),
  acted_at timestamptz not null default now()
);

alter table public.training_session_schedule_history enable row level security;
revoke all on public.training_session_schedule_history from anon, authenticated;
grant select on public.training_session_schedule_history to authenticated;
drop policy if exists "Training viewers read session schedule history"
  on public.training_session_schedule_history;
create policy "Training viewers read session schedule history"
on public.training_session_schedule_history for select to authenticated
using (public.has_permission('training.view'));

-- Completion is never bypassed by an ordinary portal call. Eligibility is
-- recalculated under lock and all required obligations must be satisfied.
drop function if exists public.complete_training_enrollment(uuid, uuid, text, boolean);
drop function if exists public.complete_training_enrollment(uuid, uuid, text);
create function public.complete_training_enrollment(
  p_enrollment_id uuid,
  p_next_training_id uuid default null,
  p_recommendation_text text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  enrollment public.member_trainings%rowtype;
  recalculated_status text;
begin
  if not public.has_permission('training.complete') then
    raise exception 'training.complete permission required' using errcode = '42501';
  end if;
  if p_next_training_id is not null and not public.has_permission('training.recommend') then
    raise exception 'training.recommend permission required' using errcode = '42501';
  end if;

  select * into enrollment from public.member_trainings
  where id = p_enrollment_id for update;
  if not found then
    raise exception 'Training enrollment not found' using errcode = 'P0002';
  end if;

  recalculated_status := public.recalculate_training_eligibility(p_enrollment_id);
  if recalculated_status <> 'ready_for_completion' then
    raise exception 'Completion Checklist is not satisfied. Complete required attendance or remedials first.'
      using errcode = 'P0001';
  end if;

  update public.member_trainings
  set workflow_status = 'completed', completed_at = now()
  where id = p_enrollment_id and workflow_status = 'ready_for_completion';

  if p_next_training_id is not null then
    insert into public.training_advancement_eligibility (
      member_id, source_member_training_id, next_training_id, status, recommendation
    ) values (
      enrollment.member_id, enrollment.id, p_next_training_id, 'recommended', p_recommendation_text
    ) on conflict (source_member_training_id, next_training_id)
      do update set status = 'recommended', recommendation = excluded.recommendation,
        recommended_by = auth.uid(), recommended_at = now(), updated_at = now();
  end if;
end;
$$;

create or replace function public.reschedule_training_session(
  p_session_id uuid,
  p_new_date date,
  p_shift_succeeding boolean default false,
  p_reason text default null
)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  target public.training_sessions%rowtype;
  class_status text;
  current_session_id uuid;
  day_delta integer;
  changed integer := 0;
  item record;
begin
  if not public.has_permission('training.attendance') then
    raise exception 'training.attendance permission required' using errcode = '42501';
  end if;
  if p_new_date is null then
    raise exception 'A session date is required' using errcode = '22023';
  end if;

  select * into target from public.training_sessions where id = p_session_id for update;
  if not found then raise exception 'Training session not found' using errcode = 'P0002'; end if;
  select status into class_status from public.training_batches where id = target.batch_id;
  if class_status not in ('open', 'ongoing') then
    raise exception 'Only a Current Class session can be rescheduled' using errcode = 'P0001';
  end if;

  current_session_id := public.get_current_training_session(target.batch_id);
  if exists (select 1 from public.training_attendance where session_id = target.id)
     and not public.has_permission('admin.settings') then
    raise exception 'Only an Administrator can correct a completed session date' using errcode = '42501';
  end if;
  if exists (select 1 from public.training_attendance where session_id = target.id)
     and p_shift_succeeding then
    raise exception 'A completed session date correction cannot shift succeeding sessions' using errcode = 'P0001';
  end if;

  day_delta := p_new_date - target.session_date::date;
  for item in
    select * from public.training_sessions
    where batch_id = target.batch_id
      and (id = target.id or (p_shift_succeeding and display_order > target.display_order))
    order by display_order for update
  loop
    insert into public.training_session_schedule_history (
      session_id, previous_date, new_date, shifted_succeeding, reason
    ) values (
      item.id, item.session_date,
      case when item.id = target.id then p_new_date::timestamptz else item.session_date + make_interval(days => day_delta) end,
      p_shift_succeeding, nullif(trim(p_reason), '')
    );
    update public.training_sessions set
      session_date = case when id = target.id then p_new_date::timestamptz else session_date + make_interval(days => day_delta) end,
      updated_at = now()
    where id = item.id;
    changed := changed + 1;
  end loop;

  update public.training_batches batch set
    ends_on = (select max(session_date)::date from public.training_sessions
      where batch_id = batch.id and display_order between 1 and batch.required_sessions),
    updated_at = now()
  where batch.id = target.batch_id;
  return changed;
end;
$$;

create or replace function public.close_training_class(p_class_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  unresolved_pending integer;
  unresolved_active integer;
  unresolved_remedials integer;
begin
  if not public.has_permission('training.complete') then
    raise exception 'training.complete permission required' using errcode = '42501';
  end if;

  perform 1 from public.training_batches
  where id = p_class_id and status in ('open', 'ongoing') for update;
  if not found then raise exception 'Active Current Class not found' using errcode = 'P0002'; end if;

  select count(*) filter (where workflow_status = 'pending_enrollment'),
         count(*) filter (where workflow_status in ('in_progress','for_remedial','ready_for_completion'))
    into unresolved_pending, unresolved_active
  from public.member_trainings
  where batch_id = p_class_id and archived_at is null;

  select count(*) into unresolved_remedials
  from public.training_remedials remedial
  join public.member_trainings enrollment on enrollment.id = remedial.member_training_id
  where enrollment.batch_id = p_class_id
    and remedial.status = 'scheduled'
    and enrollment.workflow_status not in ('completed','withdrawn','cancelled');

  if unresolved_pending + unresolved_active + unresolved_remedials > 0 then
    return jsonb_build_object(
      'closed', false,
      'pending', unresolved_pending,
      'active', unresolved_active,
      'incompleteRemedials', unresolved_remedials
    );
  end if;

  update public.training_batches set status = 'completed',
    ends_on = coalesce(ends_on, current_date), updated_at = now()
  where id = p_class_id;
  return jsonb_build_object('closed', true, 'pending', 0, 'active', 0, 'incompleteRemedials', 0);
end;
$$;

create or replace function public.archive_training_class(p_class_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_permission('admin.settings') then
    raise exception 'Administrator permission required' using errcode = '42501';
  end if;
  update public.training_batches set archived_at = now(), archived_by = auth.uid(), updated_at = now()
  where id = p_class_id and status in ('completed', 'cancelled') and archived_at is null;
  if not found then
    raise exception 'Only a Previous Class can be archived' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.complete_training_enrollment(uuid, uuid, text) from public, anon;
revoke all on function public.reschedule_training_session(uuid, date, boolean, text) from public, anon;
revoke all on function public.close_training_class(uuid) from public, anon;
revoke all on function public.archive_training_class(uuid) from public, anon;
grant execute on function public.complete_training_enrollment(uuid, uuid, text) to authenticated;
grant execute on function public.reschedule_training_session(uuid, date, boolean, text) to authenticated;
grant execute on function public.close_training_class(uuid) to authenticated;
grant execute on function public.archive_training_class(uuid) to authenticated;

commit;
