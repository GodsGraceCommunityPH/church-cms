begin;

create or replace function public.reset_training_cycle_for_demo(p_cycle_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  reset_count integer;
begin
  if not public.has_permission('admin.settings') then
    raise exception 'Administrator permission required' using errcode = '42501';
  end if;

  update public.member_trainings
  set workflow_status = 'cancelled'
  where batch_id = p_cycle_id
    and archived_at is null
    and workflow_status in (
      'pending_enrollment',
      'in_progress',
      'for_remedial',
      'ready_for_completion'
    );

  get diagnostics reset_count = row_count;

  update public.training_batches
  set status = 'cancelled',
      ends_on = coalesce(ends_on, current_date),
      updated_at = now()
  where id = p_cycle_id
    and status in ('open', 'ongoing');

  if not found then
    raise exception 'Active Training cycle not found' using errcode = 'P0002';
  end if;

  return reset_count;
end;
$$;

revoke all on function public.reset_training_cycle_for_demo(uuid) from public;
revoke all on function public.reset_training_cycle_for_demo(uuid) from anon;
grant execute on function public.reset_training_cycle_for_demo(uuid) to authenticated;

commit;
