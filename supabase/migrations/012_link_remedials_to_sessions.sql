begin;

alter table public.training_remedials
  add column if not exists session_id uuid
  references public.training_sessions(id) on delete set null;

create index if not exists training_remedials_session_idx
  on public.training_remedials (member_training_id, session_id);

commit;
