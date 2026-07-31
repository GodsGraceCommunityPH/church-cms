begin;

alter table public.training_batches add column if not exists required_sessions integer not null default 10 check (required_sessions > 0);
alter table public.training_batches add column if not exists cadence_days integer not null default 7 check (cadence_days > 0);
alter table public.training_batches add column if not exists excused_counts boolean not null default false;

update public.training_batches batch set required_sessions = counts.total
from (select batch_id, count(*)::integer total from public.training_sessions group by batch_id) counts
where counts.batch_id = batch.id and counts.total > 0;

create table if not exists public.training_completion_checklist (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.training_batches(id) on delete restrict,
  requirement_key text not null,
  label text not null,
  configuration jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, requirement_key)
);

insert into public.training_completion_checklist (batch_id, requirement_key, label, configuration)
select id, 'required_attendance', 'Required attendance completed', jsonb_build_object('required_sessions', required_sessions)
from public.training_batches on conflict (batch_id, requirement_key) do nothing;

alter table public.training_completion_checklist enable row level security;
revoke all on public.training_completion_checklist from anon;
grant select, insert, update on public.training_completion_checklist to authenticated;
create policy "Training viewers read completion checklist" on public.training_completion_checklist
for select to authenticated using (public.has_permission('training.view'));
create policy "Enrollment managers manage completion checklist" on public.training_completion_checklist
for all to authenticated using (public.has_permission('training.enroll')) with check (public.has_permission('training.enroll'));

create or replace function public.create_training_cycle(p_training_id uuid, p_start_date date, p_required_sessions integer default 10, p_cadence_days integer default 7)
returns public.training_batches language plpgsql security definer set search_path = '' as $$
declare cycle public.training_batches%rowtype; program_name text; session_number integer;
begin
  if not public.has_permission('training.enroll') then raise exception 'training.enroll permission required' using errcode='42501'; end if;
  if p_start_date is null or p_required_sessions < 1 or p_cadence_days < 1 then raise exception 'Valid class date, required sessions, and cadence are required' using errcode='22023'; end if;
  if exists(select 1 from public.training_batches where training_id=p_training_id and status in ('open','ongoing')) then raise exception 'This program already has a Current Class' using errcode='P0001'; end if;
  select name into program_name from public.trainings where id=p_training_id;
  insert into public.training_batches(training_id,name,status,starts_on,required_sessions,cadence_days)
  values(p_training_id,program_name||' Class - '||to_char(clock_timestamp(),'YYYYMMDD-HH24MISS-MS'),'open',p_start_date,p_required_sessions,p_cadence_days) returning * into cycle;
  insert into public.training_completion_checklist(batch_id,requirement_key,label,configuration)
  values(cycle.id,'required_attendance','Required attendance completed',jsonb_build_object('required_sessions',p_required_sessions));
  for session_number in 1..p_required_sessions loop
    insert into public.training_sessions(batch_id,title,session_date,display_order)
    values(cycle.id,'Week '||session_number,(p_start_date + ((session_number-1)*p_cadence_days))::timestamptz,session_number);
  end loop;
  return cycle;
end; $$;

create or replace function public.start_training_cycle(p_cycle_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare class_start date;
begin
  if not public.has_permission('training.enroll') then raise exception 'training.enroll permission required' using errcode='42501'; end if;
  update public.training_batches set status='ongoing', starts_on=coalesce(starts_on,current_date), updated_at=now()
  where id=p_cycle_id and status='open' returning starts_on into class_start;
  if class_start is null then raise exception 'Open Current Class not found' using errcode='P0002'; end if;
  update public.member_trainings set workflow_status='in_progress', started_at=class_start::timestamptz
  where batch_id=p_cycle_id and archived_at is null and workflow_status='pending_enrollment';
end; $$;

create or replace function public.record_training_attendance(p_enrollment_id uuid,p_session_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare class_status text;
begin
  if not public.has_permission('training.attendance') then raise exception 'training.attendance permission required' using errcode='42501'; end if;
  if p_status not in ('present','late','absent','excused') then raise exception 'Invalid attendance status' using errcode='22023'; end if;
  select batch.status into class_status from public.member_trainings enrollment join public.training_batches batch on batch.id=enrollment.batch_id
  join public.training_sessions session on session.batch_id=batch.id where enrollment.id=p_enrollment_id and session.id=p_session_id;
  if class_status <> 'ongoing' then raise exception 'Attendance can only be recorded after the class starts' using errcode='P0001'; end if;
  insert into public.training_attendance(member_training_id,session_id,status)
  values(p_enrollment_id,p_session_id,p_status) on conflict(member_training_id,session_id) do update set status=excluded.status,recorded_by=auth.uid(),recorded_at=now(),updated_at=now();
  update public.member_trainings enrollment set workflow_status='ready_for_completion'
  from public.training_batches batch where enrollment.id=p_enrollment_id and batch.id=enrollment.batch_id
    and enrollment.workflow_status in ('in_progress','for_remedial')
    and (select count(*) from public.training_attendance attendance where attendance.member_training_id=enrollment.id and (attendance.status in ('present','late') or (batch.excused_counts and attendance.status='excused'))) >= batch.required_sessions;
end; $$;

create or replace function public.enroll_training_batch_students(p_batch_id uuid,p_member_ids uuid[])
returns integer language plpgsql security definer set search_path='' as $$
declare target_training_id uuid; requested_member uuid; restored_id uuid; changed_count integer := 0;
begin
  if not public.has_permission('training.enroll') then raise exception 'training.enroll permission required' using errcode='42501'; end if;
  select training_id into target_training_id from public.training_batches where id=p_batch_id and status in ('open','ongoing');
  if target_training_id is null then raise exception 'Active Current Class not found' using errcode='P0002'; end if;
  foreach requested_member in array p_member_ids loop
    if exists(select 1 from public.member_trainings where member_id=requested_member and training_id=target_training_id and archived_at is null and workflow_status in ('pending_enrollment','in_progress','for_remedial','ready_for_completion')) then continue; end if;
    select id into restored_id from public.member_trainings where member_id=requested_member and training_id=target_training_id and workflow_status='cancelled' order by updated_at desc limit 1 for update;
    if restored_id is not null then
      update public.member_trainings set batch_id=p_batch_id,workflow_status='pending_enrollment',started_at=null,completed_at=null,archived_at=null where id=restored_id;
    else
      insert into public.member_trainings(member_id,training_id,status,workflow_status,batch_id) values(requested_member,target_training_id,'Not Started'::public.training_status,'pending_enrollment',p_batch_id);
    end if;
    changed_count := changed_count + 1; restored_id := null;
  end loop;
  return changed_count;
end; $$;

drop function if exists public.complete_training_enrollment(uuid,uuid,text);
create or replace function public.complete_training_enrollment(p_enrollment_id uuid,p_next_training_id uuid default null,p_recommendation_text text default null,p_admin_override boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare enrollment public.member_trainings%rowtype; required_count integer; attended_count integer; counts_excused boolean;
begin
  if not public.has_permission('training.complete') then raise exception 'training.complete permission required' using errcode='42501'; end if;
  if p_admin_override and not public.has_permission('admin.settings') then raise exception 'Administrator override permission required' using errcode='42501'; end if;
  if p_next_training_id is not null and not public.has_permission('training.recommend') then raise exception 'training.recommend permission required' using errcode='42501'; end if;
  select mt,batch.required_sessions,batch.excused_counts into enrollment,required_count,counts_excused from public.member_trainings mt join public.training_batches batch on batch.id=mt.batch_id where mt.id=p_enrollment_id for update;
  select count(*) into attended_count from public.training_attendance where member_training_id=p_enrollment_id and (status in ('present','late') or (counts_excused and status='excused'));
  if not p_admin_override and attended_count < required_count then raise exception 'Completion Checklist is not satisfied: required attendance is incomplete' using errcode='P0001'; end if;
  update public.member_trainings set workflow_status='completed',completed_at=now() where id=p_enrollment_id;
  if p_next_training_id is not null then
    insert into public.training_advancement_eligibility(member_id,source_member_training_id,next_training_id,status,recommendation)
    values(enrollment.member_id,enrollment.id,p_next_training_id,'recommended',p_recommendation_text)
    on conflict(source_member_training_id,next_training_id) do update set status='recommended',recommendation=excluded.recommendation,recommended_by=auth.uid(),recommended_at=now(),updated_at=now();
  end if;
end; $$;

create or replace function public.reopen_training_enrollment(p_enrollment_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.has_permission('admin.settings') then raise exception 'Administrator permission required' using errcode='42501'; end if;
  update public.member_trainings set workflow_status='in_progress',completed_at=null where id=p_enrollment_id and workflow_status='completed';
  if not found then raise exception 'Completed enrollment not found' using errcode='P0002'; end if;
end; $$;

revoke all on function public.create_training_cycle(uuid,date,integer,integer), public.start_training_cycle(uuid), public.record_training_attendance(uuid,uuid,text), public.enroll_training_batch_students(uuid,uuid[]), public.complete_training_enrollment(uuid,uuid,text,boolean), public.reopen_training_enrollment(uuid) from public, anon;
grant execute on function public.create_training_cycle(uuid,date,integer,integer), public.start_training_cycle(uuid), public.record_training_attendance(uuid,uuid,text), public.enroll_training_batch_students(uuid,uuid[]), public.complete_training_enrollment(uuid,uuid,text,boolean), public.reopen_training_enrollment(uuid) to authenticated;
commit;
