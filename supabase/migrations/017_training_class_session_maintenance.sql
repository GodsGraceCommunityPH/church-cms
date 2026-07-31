begin;

create or replace function public.delete_cancelled_training_cycle(p_cycle_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare enrollment_ids uuid[]; session_ids uuid[];
begin
  if not public.has_permission('admin.settings') then raise exception 'Administrator permission required' using errcode='42501'; end if;
  if not exists(select 1 from public.training_batches where id=p_cycle_id and status='cancelled') then raise exception 'Only cancelled classes can be deleted' using errcode='P0001'; end if;
  select coalesce(array_agg(id),'{}') into enrollment_ids from public.member_trainings where batch_id=p_cycle_id;
  select coalesce(array_agg(id),'{}') into session_ids from public.training_sessions where batch_id=p_cycle_id;
  delete from public.training_attendance where member_training_id=any(enrollment_ids) or session_id=any(session_ids);
  delete from public.training_notes where member_training_id=any(enrollment_ids);
  delete from public.training_remedials where member_training_id=any(enrollment_ids);
  delete from public.training_advancement_eligibility where source_member_training_id=any(enrollment_ids);
  delete from public.member_training_status_history where member_training_id=any(enrollment_ids);
  delete from public.member_trainings where id=any(enrollment_ids);
  delete from public.training_sessions where id=any(session_ids);
  delete from public.training_completion_checklist where batch_id=p_cycle_id;
  delete from public.training_batches where id=p_cycle_id;
end; $$;

create or replace function public.delete_unrecorded_training_session(p_session_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare target_batch_id uuid; remaining_sessions integer;
begin
  if not public.has_permission('training.enroll') then raise exception 'training.enroll permission required' using errcode='42501'; end if;
  select session.batch_id into target_batch_id from public.training_sessions session join public.training_batches batch on batch.id=session.batch_id where session.id=p_session_id and batch.status in ('open','ongoing');
  if target_batch_id is null then raise exception 'Editable Current Class session not found' using errcode='P0002'; end if;
  if exists(select 1 from public.training_attendance where session_id=p_session_id) then raise exception 'This session has attendance history and cannot be removed. Edit it instead.' using errcode='P0001'; end if;
  delete from public.training_sessions where id=p_session_id;
  select count(*)::integer into remaining_sessions from public.training_sessions where batch_id=target_batch_id;
  if remaining_sessions < 1 then raise exception 'A class must retain at least one session' using errcode='P0001'; end if;
  update public.training_batches set required_sessions=remaining_sessions,updated_at=now() where id=target_batch_id;
  update public.training_completion_checklist set configuration=jsonb_set(configuration,'{required_sessions}',to_jsonb(remaining_sessions)),updated_at=now() where batch_id=target_batch_id and requirement_key='required_attendance';
end; $$;

revoke all on function public.delete_cancelled_training_cycle(uuid), public.delete_unrecorded_training_session(uuid) from public,anon;
grant execute on function public.delete_cancelled_training_cycle(uuid), public.delete_unrecorded_training_session(uuid) to authenticated;
commit;
