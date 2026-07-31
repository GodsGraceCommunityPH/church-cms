begin;

-- Some installations retained the legacy all-time member/program unique
-- constraint under a database-generated name. Remove only that exact
-- two-column constraint; the partial active-enrollment index from 010 remains.
do $$
declare legacy_constraint text;
begin
  select constraint_row.conname into legacy_constraint
  from pg_constraint constraint_row
  where constraint_row.conrelid = 'public.member_trainings'::regclass
    and constraint_row.contype = 'u'
    and cardinality(constraint_row.conkey) = 2
    and (
      select array_agg(attribute.attname order by attribute.attname)
      from unnest(constraint_row.conkey) key_number
      join pg_attribute attribute
        on attribute.attrelid = constraint_row.conrelid
       and attribute.attnum = key_number
    ) = array['member_id', 'training_id']::name[]
  limit 1;
  if legacy_constraint is not null then
    execute format('alter table public.member_trainings drop constraint %I', legacy_constraint);
  end if;
end;
$$;

create or replace function public.get_or_create_training_cycle(p_training_id uuid)
returns public.training_batches language plpgsql security definer set search_path = '' as $$
declare cycle public.training_batches%rowtype; program_name text;
begin
  if not public.has_permission('training.enroll') then raise exception 'training.enroll permission required' using errcode = '42501'; end if;
  select * into cycle from public.training_batches where training_id = p_training_id and status in ('open', 'ongoing') order by created_at desc limit 1;
  if found then return cycle; end if;
  select name into program_name from public.trainings where id = p_training_id;
  if program_name is null then raise exception 'Training program not found' using errcode = 'P0002'; end if;
  insert into public.training_batches (training_id, name, status, starts_on)
  values (p_training_id, program_name || ' Training Run - ' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS-MS'), 'open', current_date)
  returning * into cycle;
  return cycle;
exception when unique_violation then
  select * into cycle from public.training_batches where training_id = p_training_id and status in ('open', 'ongoing') order by created_at desc limit 1;
  if cycle.id is null then raise; end if;
  return cycle;
end; $$;

revoke all on function public.get_or_create_training_cycle(uuid) from public;
revoke all on function public.get_or_create_training_cycle(uuid) from anon;
grant execute on function public.get_or_create_training_cycle(uuid) to authenticated;

create or replace function public.delete_cancelled_training_cycle(p_cycle_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare enrollment_ids uuid[]; session_ids uuid[];
begin
  if not public.has_permission('admin.settings') then raise exception 'Administrator permission required' using errcode = '42501'; end if;
  if not exists (select 1 from public.training_batches where id = p_cycle_id and status = 'cancelled') then
    raise exception 'Only cancelled Training cycles can be deleted' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(id), '{}') into enrollment_ids from public.member_trainings where batch_id = p_cycle_id;
  select coalesce(array_agg(id), '{}') into session_ids from public.training_sessions where batch_id = p_cycle_id;
  delete from public.training_attendance where member_training_id = any(enrollment_ids) or session_id = any(session_ids);
  delete from public.training_notes where member_training_id = any(enrollment_ids);
  delete from public.training_remedials where member_training_id = any(enrollment_ids);
  delete from public.training_advancement_eligibility where source_member_training_id = any(enrollment_ids);
  delete from public.member_training_status_history where member_training_id = any(enrollment_ids);
  delete from public.member_trainings where id = any(enrollment_ids);
  delete from public.training_sessions where id = any(session_ids);
  delete from public.training_batches where id = p_cycle_id;
end; $$;

revoke all on function public.delete_cancelled_training_cycle(uuid) from public;
revoke all on function public.delete_cancelled_training_cycle(uuid) from anon;
grant execute on function public.delete_cancelled_training_cycle(uuid) to authenticated;
commit;
