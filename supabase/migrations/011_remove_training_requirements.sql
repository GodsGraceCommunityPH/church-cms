begin;

drop trigger if exists ready_when_requirements_complete
on public.member_training_requirements;
drop trigger if exists create_member_training_checklist
on public.member_trainings;
drop trigger if exists propagate_training_requirement
on public.training_requirements;

drop function if exists public.ready_when_requirements_complete();
drop function if exists public.create_member_training_checklist();
drop function if exists public.propagate_training_requirement();

alter table public.training_remedials
  drop column if exists requirement_id;

drop table if exists public.member_training_requirements;
drop table if exists public.training_requirements;

commit;
