begin;

-- Migration 027 introduced the audited correction before session assignments
-- existed. Preserve it internally and put an assignment-aware guard in front.
alter function public.correct_completed_student_session_record(uuid,uuid,text,jsonb,text)
  rename to correct_completed_student_session_record_program_scoped_legacy;
revoke all on function public.correct_completed_student_session_record_program_scoped_legacy(uuid,uuid,text,jsonb,text)
  from public,anon,authenticated;

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
set search_path=''
as $$
declare requirement_item jsonb;
begin
  if p_requirements is null or jsonb_typeof(p_requirements)<>'array' then
    raise exception 'Requirement corrections must be an array' using errcode='22023';
  end if;
  for requirement_item in select value from jsonb_array_elements(p_requirements) loop
    if not exists(
      select 1 from public.training_session_requirements assignment
      where assignment.training_session_id=p_session_id
        and assignment.program_requirement_id=nullif(requirement_item->>'requirement_id','')::uuid
    ) then
      raise exception 'Correction includes a requirement not assigned to this session' using errcode='P0001';
    end if;
  end loop;
  perform public.correct_completed_student_session_record_program_scoped_legacy(
    p_enrollment_id,p_session_id,p_attendance_status,p_requirements,p_reason
  );
end;
$$;

revoke all on function public.correct_completed_student_session_record(uuid,uuid,text,jsonb,text)
  from public,anon;
grant execute on function public.correct_completed_student_session_record(uuid,uuid,text,jsonb,text)
  to authenticated;

commit;
