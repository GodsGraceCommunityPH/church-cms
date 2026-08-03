begin;

create or replace function public.update_training_session_details(
  p_session_id uuid,
  p_title text,
  p_session_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.training_sessions%rowtype;
  normalized_title text := trim(p_title);
  class_status text;
begin
  if not public.has_permission('training.attendance') then
    raise exception 'training.attendance permission required' using errcode = '42501';
  end if;

  if normalized_title is null or normalized_title = '' then
    raise exception 'A session name is required' using errcode = '22023';
  end if;
  if char_length(normalized_title) > 120 then
    raise exception 'Session name must be 120 characters or fewer' using errcode = '22023';
  end if;
  if p_session_date is null then
    raise exception 'A session date is required' using errcode = '22023';
  end if;

  select * into target
  from public.training_sessions
  where id = p_session_id
  for update;
  if not found then
    raise exception 'Training session not found' using errcode = 'P0002';
  end if;

  select status into class_status
  from public.training_batches
  where id = target.batch_id;
  if class_status not in ('open', 'ongoing') then
    raise exception 'Only a Current Class session can be edited' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.training_attendance
    where session_id = target.id
  ) then
    raise exception 'Completed session details are read-only' using errcode = 'P0001';
  end if;

  if target.session_date::date is distinct from p_session_date then
    insert into public.training_session_schedule_history (
      session_id,
      previous_date,
      new_date,
      shifted_succeeding,
      reason
    ) values (
      target.id,
      target.session_date,
      p_session_date::timestamptz,
      false,
      'Session details updated'
    );
  end if;

  update public.training_sessions
  set title = normalized_title,
      session_date = p_session_date::timestamptz,
      updated_at = now()
  where id = target.id;

  update public.training_batches batch
  set ends_on = (
        select max(session.session_date)::date
        from public.training_sessions session
        where session.batch_id = batch.id
          and session.display_order between 1 and batch.required_sessions
      ),
      updated_at = now()
  where batch.id = target.batch_id;
exception
  when unique_violation then
    raise exception 'Another session in this class already uses that name' using errcode = '23505';
end;
$$;

revoke all on function public.update_training_session_details(uuid, text, date) from public;
revoke all on function public.update_training_session_details(uuid, text, date) from anon;
grant execute on function public.update_training_session_details(uuid, text, date) to authenticated;

commit;
