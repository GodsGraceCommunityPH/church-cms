begin;

-- The completed-session correction must be one atomic operation. This function
-- updates attendance and assigned requirement progress, records the audit event,
-- then recalculates eligibility. Any failure rolls the entire correction back.
create or replace function public.correct_completed_student_session_record(
  p_enrollment_id uuid,
  p_session_id uuid,
  p_attendance_status text,
  p_requirements jsonb,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  enrollment public.member_trainings%rowtype;
  target_session public.training_sessions%rowtype;
  current_session_id uuid;
  current_order integer;
  previous_attendance text;
  previous_requirements jsonb;
  corrected_requirements jsonb;
  requirement_item jsonb;
  requirement_id uuid;
  requirement_completed boolean;
begin
  if not public.has_permission('training.attendance') then
    raise exception 'training.attendance permission required' using errcode = '42501';
  end if;

  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'A correction reason is required' using errcode = '22023';
  end if;

  if p_attendance_status is not null
     and p_attendance_status not in ('present', 'late', 'absent', 'excused') then
    raise exception 'Invalid attendance correction status' using errcode = '22023';
  end if;

  if p_requirements is null or jsonb_typeof(p_requirements) <> 'array' then
    raise exception 'Requirement corrections must be an array' using errcode = '22023';
  end if;

  select *
  into enrollment
  from public.member_trainings
  where id = p_enrollment_id
    and archived_at is null
  for update;

  if not found then
    raise exception 'Training enrollment not found' using errcode = 'P0002';
  end if;

  select *
  into target_session
  from public.training_sessions
  where id = p_session_id
  for update;

  if not found or target_session.batch_id is distinct from enrollment.batch_id then
    raise exception 'Session does not belong to this student enrollment' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.training_batches batch
    where batch.id = enrollment.batch_id
      and batch.status = 'ongoing'
  ) then
    raise exception 'Corrections are available only within the Current Class' using errcode = 'P0001';
  end if;

  current_session_id := public.get_current_training_session(enrollment.batch_id);
  select display_order
  into current_order
  from public.training_sessions
  where id = current_session_id;

  if current_session_id = p_session_id
     or (current_order is not null and target_session.display_order >= current_order) then
    raise exception 'Only a completed session record can be corrected' using errcode = 'P0001';
  end if;

  select status
  into previous_attendance
  from public.training_attendance
  where member_training_id = p_enrollment_id
    and session_id = p_session_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'requirement_id', requirement.id,
        'name', requirement.name,
        'completed', coalesce(progress.completed, false)
      ) order by requirement.display_order
    ),
    '[]'::jsonb
  )
  into previous_requirements
  from public.training_session_requirements assignment
  join public.training_program_requirements requirement
    on requirement.id = assignment.program_requirement_id
  left join public.member_training_session_requirement_progress progress
    on progress.program_requirement_id = requirement.id
   and progress.member_training_id = p_enrollment_id
   and progress.training_session_id = p_session_id
  where assignment.training_session_id = p_session_id;

  if p_attendance_status is null then
    delete from public.training_attendance
    where member_training_id = p_enrollment_id
      and session_id = p_session_id;
  else
    insert into public.training_attendance (
      member_training_id,
      session_id,
      status,
      recorded_by,
      recorded_at
    ) values (
      p_enrollment_id,
      p_session_id,
      p_attendance_status,
      auth.uid(),
      now()
    )
    on conflict (member_training_id, session_id) do update
      set status = excluded.status,
          recorded_by = auth.uid(),
          recorded_at = now(),
          updated_at = now();
  end if;

  for requirement_item in
    select value from jsonb_array_elements(p_requirements)
  loop
    requirement_id := nullif(requirement_item ->> 'requirement_id', '')::uuid;
    requirement_completed := coalesce((requirement_item ->> 'completed')::boolean, false);

    if not exists (
      select 1
      from public.training_session_requirements assignment
      where assignment.training_session_id = p_session_id
        and assignment.program_requirement_id = requirement_id
    ) then
      raise exception 'Correction includes a requirement not assigned to this session' using errcode = 'P0001';
    end if;

    if requirement_completed then
      insert into public.member_training_session_requirement_progress (
        member_training_id,
        training_session_id,
        program_requirement_id,
        completed,
        completed_at,
        completed_by
      ) values (
        p_enrollment_id,
        p_session_id,
        requirement_id,
        true,
        now(),
        auth.uid()
      )
      on conflict (member_training_id, training_session_id, program_requirement_id) do update
        set completed = true,
            completed_at = now(),
            completed_by = auth.uid(),
            updated_at = now();
    else
      delete from public.member_training_session_requirement_progress
      where member_training_id = p_enrollment_id
        and training_session_id = p_session_id
        and program_requirement_id = requirement_id;
    end if;
  end loop;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'requirement_id', requirement.id,
        'name', requirement.name,
        'completed', coalesce(progress.completed, false)
      ) order by requirement.display_order
    ),
    '[]'::jsonb
  )
  into corrected_requirements
  from public.training_session_requirements assignment
  join public.training_program_requirements requirement
    on requirement.id = assignment.program_requirement_id
  left join public.member_training_session_requirement_progress progress
    on progress.program_requirement_id = requirement.id
   and progress.member_training_id = p_enrollment_id
   and progress.training_session_id = p_session_id
  where assignment.training_session_id = p_session_id;

  insert into public.member_training_workflow_events (
    member_training_id,
    event_type,
    previous_status,
    new_status,
    previous_batch_id,
    new_batch_id,
    reason,
    acted_by,
    snapshot
  ) values (
    enrollment.id,
    'student_record_corrected',
    enrollment.workflow_status,
    enrollment.workflow_status,
    enrollment.batch_id,
    enrollment.batch_id,
    btrim(p_reason),
    auth.uid(),
    jsonb_build_object(
      'session_id', target_session.id,
      'session_title', target_session.title,
      'previous_attendance', previous_attendance,
      'new_attendance', p_attendance_status,
      'previous_requirements', previous_requirements,
      'new_requirements', corrected_requirements
    )
  );

  perform public.recalculate_training_eligibility(p_enrollment_id);
end;
$$;

revoke all on function public.correct_completed_student_session_record(uuid, uuid, text, jsonb, text)
  from public, anon;
grant execute on function public.correct_completed_student_session_record(uuid, uuid, text, jsonb, text)
  to authenticated;

commit;
