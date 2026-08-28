begin;

alter table public.evangelism_contacts
  add column if not exists reached_by_member_id uuid references public.members(id) on delete set null;

create index if not exists evangelism_contacts_reached_by_member_idx
  on public.evangelism_contacts(reached_by_member_id);

commit;
