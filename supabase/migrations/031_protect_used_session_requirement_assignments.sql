begin;

create or replace function public.prevent_used_session_requirement_removal()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if exists(
    select 1
    from public.member_training_session_requirement_progress progress
    where progress.training_session_id=old.training_session_id
      and progress.program_requirement_id=old.program_requirement_id
  ) then
    raise exception 'This requirement has student progress and cannot be removed from the session' using errcode='P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists protect_used_session_requirement_removal
  on public.training_session_requirements;
create trigger protect_used_session_requirement_removal
before delete on public.training_session_requirements
for each row execute function public.prevent_used_session_requirement_removal();

commit;

-- Recovery: dropping this trigger restores the migration-028 removal behavior.
-- It does not modify or remove assignments or student progress.
