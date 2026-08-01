begin;

-- One remedial record satisfies one missed regular-session obligation. Existing
-- attendance remains attached to its original session and is never rewritten.
create index if not exists training_remedials_session_attempt_idx
  on public.training_remedials (member_training_id, session_id, status);

create or replace function public.training_obligation_is_satisfied(
  p_enrollment_id uuid,
  p_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.member_trainings enrollment
    join public.training_batches batch on batch.id = enrollment.batch_id
    join public.training_sessions session
      on session.id = p_session_id
     and session.batch_id = enrollment.batch_id
     and session.display_order between 1 and batch.required_sessions
    left join public.training_attendance attendance
      on attendance.member_training_id = enrollment.id
     and attendance.session_id = session.id
    where enrollment.id = p_enrollment_id
      and (
        attendance.status in ('present', 'late')
        or (batch.excused_counts and attendance.status = 'excused')
        or (
          attendance.status = 'absent'
          and exists (
            select 1
            from public.training_remedials remedial
            where remedial.member_training_id = enrollment.id
              and remedial.session_id = session.id
              and remedial.status = 'completed'
              and remedial.completed_at is not null
          )
        )
      )
  );
$$;

create or replace function public.recalculate_training_eligibility(
  p_enrollment_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  enrollment public.member_trainings%rowtype;
  required_count integer;
  satisfied_count integer;
  unresolved_absence boolean;
  next_status text;
begin
  select * into enrollment
  from public.member_trainings
  where id = p_enrollment_id
  for update;

  if not found then
    raise exception 'Training enrollment not found' using errcode = 'P0002';
  end if;

  if enrollment.workflow_status not in (
    'in_progress', 'for_remedial', 'ready_for_completion'
  ) then
    return enrollment.workflow_status;
  end if;

  select batch.required_sessions into required_count
  from public.training_batches batch
  where batch.id = enrollment.batch_id;

  if required_count is null then
    raise exception 'Current Class not found for enrollment' using errcode = 'P0002';
  end if;

  select count(*)::integer into satisfied_count
  from public.training_sessions session
  where session.batch_id = enrollment.batch_id
    and session.display_order between 1 and required_count
    and public.training_obligation_is_satisfied(enrollment.id, session.id);

  select exists (
    select 1
    from public.training_sessions session
    join public.training_attendance attendance
      on attendance.session_id = session.id
     and attendance.member_training_id = enrollment.id
     and attendance.status = 'absent'
    where session.batch_id = enrollment.batch_id
      and session.display_order between 1 and required_count
      and not public.training_obligation_is_satisfied(enrollment.id, session.id)
  ) into unresolved_absence;

  next_status := case
    when satisfied_count >= required_count then 'ready_for_completion'
    when unresolved_absence then 'for_remedial'
    else 'in_progress'
  end;

  update public.member_trainings
  set workflow_status = next_status
  where id = enrollment.id
    and workflow_status is distinct from next_status;

  return next_status;
end;
$$;

create or replace function public.schedule_training_remedial(
  p_enrollment_id uuid,
  p_session_id uuid,
  p_scheduled_for date,
  p_notes text default null
)
returns public.training_remedials
language plpgsql
security definer
set search_path = ''
as $$
declare
  remedial public.training_remedials%rowtype;
begin
  if not public.has_permission('training.attendance') then
    raise exception 'training.attendance permission required' using errcode = '42501';
  end if;
  if p_scheduled_for is null then
    raise exception 'A remedial date is required' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.member_trainings enrollment
    join public.training_sessions session on session.batch_id = enrollment.batch_id
    join public.training_attendance attendance
      on attendance.member_training_id = enrollment.id
     and attendance.session_id = session.id
     and attendance.status = 'absent'
    where enrollment.id = p_enrollment_id
      and session.id = p_session_id
      and enrollment.workflow_status in ('in_progress', 'for_remedial', 'ready_for_completion')
  ) then
    raise exception 'Only an unresolved absence in the current class can receive remedial attendance' using errcode = 'P0001';
  end if;

  select * into remedial
  from public.training_remedials
  where member_training_id = p_enrollment_id
    and session_id = p_session_id
    and status <> 'cancelled'
  order by created_at desc
  limit 1
  for update;

  if found then
    update public.training_remedials
    set scheduled_for = p_scheduled_for,
        notes = nullif(trim(p_notes), ''),
        status = 'scheduled',
        completed_at = null,
        updated_at = now()
    where id = remedial.id
    returning * into remedial;
  else
    insert into public.training_remedials (
      member_training_id, session_id, scheduled_for, status, notes
    ) values (
      p_enrollment_id, p_session_id, p_scheduled_for, 'scheduled', nullif(trim(p_notes), '')
    ) returning * into remedial;
  end if;

  perform public.recalculate_training_eligibility(p_enrollment_id);
  return remedial;
end;
$$;

create or replace function public.complete_training_remedial(
  p_remedial_id uuid,
  p_completed_on date default current_date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  enrollment_id uuid;
begin
  if not public.has_permission('training.attendance') then
    raise exception 'training.attendance permission required' using errcode = '42501';
  end if;

  update public.training_remedials remedial
  set status = 'completed',
      completed_at = coalesce(p_completed_on, current_date)::timestamptz,
      updated_at = now()
  where remedial.id = p_remedial_id
    and remedial.status = 'scheduled'
  returning remedial.member_training_id into enrollment_id;

  if enrollment_id is null then
    raise exception 'Scheduled remedial was not found' using errcode = 'P0002';
  end if;

  perform public.recalculate_training_eligibility(enrollment_id);
end;
$$;

create or replace function public.reopen_training_remedial(
  p_remedial_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  enrollment_id uuid;
begin
  if not public.has_permission('training.attendance') then
    raise exception 'training.attendance permission required' using errcode = '42501';
  end if;

  update public.training_remedials remedial
  set status = 'scheduled', completed_at = null, updated_at = now()
  where remedial.id = p_remedial_id
    and remedial.status = 'completed'
  returning remedial.member_training_id into enrollment_id;

  if enrollment_id is null then
    raise exception 'Completed remedial was not found' using errcode = 'P0002';
  end if;

  perform public.recalculate_training_eligibility(enrollment_id);
end;
$$;

create or replace function public.complete_training_enrollment(
  p_enrollment_id uuid,
  p_next_training_id uuid default null,
  p_recommendation_text text default null,
  p_admin_override boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  enrollment public.member_trainings%rowtype;
  required_count integer;
  satisfied_count integer;
begin
  if not public.has_permission('training.complete') then
    raise exception 'training.complete permission required' using errcode = '42501';
  end if;
  if p_admin_override and not public.has_permission('admin.settings') then
    raise exception 'Administrator override permission required' using errcode = '42501';
  end if;
  if p_next_training_id is not null and not public.has_permission('training.recommend') then
    raise exception 'training.recommend permission required' using errcode = '42501';
  end if;

  select * into enrollment
  from public.member_trainings
  where id = p_enrollment_id
  for update;

  if not found then
    raise exception 'Training enrollment not found' using errcode = 'P0002';
  end if;
  if enrollment.workflow_status not in ('in_progress', 'for_remedial', 'ready_for_completion') then
    raise exception 'Only an active student can be completed' using errcode = 'P0001';
  end if;

  select batch.required_sessions into required_count
  from public.training_batches batch
  where batch.id = enrollment.batch_id;

  select count(*)::integer into satisfied_count
  from public.training_sessions session
  where session.batch_id = enrollment.batch_id
    and session.display_order between 1 and required_count
    and public.training_obligation_is_satisfied(enrollment.id, session.id);

  if not p_admin_override and satisfied_count < required_count then
    raise exception 'Completion Checklist is not satisfied: required attendance or remedial attendance is incomplete' using errcode = 'P0001';
  end if;

  update public.member_trainings
  set workflow_status = 'completed', completed_at = now()
  where id = enrollment.id;

  if p_next_training_id is not null then
    insert into public.training_advancement_eligibility (
      member_id, source_member_training_id, next_training_id, status, recommendation
    ) values (
      enrollment.member_id, enrollment.id, p_next_training_id, 'recommended', p_recommendation_text
    )
    on conflict (source_member_training_id, next_training_id)
    do update set status = 'recommended', recommendation = excluded.recommendation,
      recommended_by = auth.uid(), recommended_at = now(), updated_at = now();
  end if;
end;
$$;

-- Correct any stale active eligibility without changing attendance history.
do $$
declare enrollment_id uuid;
begin
  for enrollment_id in
    select id from public.member_trainings
    where workflow_status in ('in_progress', 'for_remedial', 'ready_for_completion')
      and batch_id is not null
      and archived_at is null
  loop
    perform public.recalculate_training_eligibility(enrollment_id);
  end loop;
end;
$$;

revoke all on function public.training_obligation_is_satisfied(uuid, uuid) from public, anon;
revoke all on function public.recalculate_training_eligibility(uuid) from public, anon;
revoke all on function public.schedule_training_remedial(uuid, uuid, date, text) from public, anon;
revoke all on function public.complete_training_remedial(uuid, date) from public, anon;
revoke all on function public.reopen_training_remedial(uuid) from public, anon;
grant execute on function public.schedule_training_remedial(uuid, uuid, date, text) to authenticated;
grant execute on function public.complete_training_remedial(uuid, date) to authenticated;
grant execute on function public.reopen_training_remedial(uuid) to authenticated;

-- Remedial mutations must recalculate eligibility, so browser clients use the
-- guarded RPCs rather than writing the table directly.
revoke insert, update, delete on public.training_remedials from authenticated;
grant select on public.training_remedials to authenticated;

commit;
