begin;
create table if not exists public.resource_discussion_notes(
 id uuid primary key, resource_id uuid not null references public.resources(id) on delete cascade,
 discussion_date date not null, body text not null default '', created_by uuid not null references public.users(id) on delete cascade default auth.uid(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint resource_note_body_size check(length(body)<=100000)
);
create index if not exists resource_notes_resource_date_idx on public.resource_discussion_notes(resource_id,discussion_date desc);
create or replace function public.touch_resource_note_updated_at() returns trigger language plpgsql set search_path='' as $$begin new.updated_at=now();return new;end$$;
drop trigger if exists resource_notes_touch_updated_at on public.resource_discussion_notes;
create trigger resource_notes_touch_updated_at before update on public.resource_discussion_notes for each row execute function public.touch_resource_note_updated_at();
alter table public.resource_discussion_notes enable row level security;
revoke all on public.resource_discussion_notes from anon;grant select,insert,update,delete on public.resource_discussion_notes to authenticated;
create policy "Resource notes view own" on public.resource_discussion_notes for select to authenticated using(public.has_permission('resources.view') and created_by=auth.uid());
create policy "Resource notes insert own" on public.resource_discussion_notes for insert to authenticated with check(public.has_permission('resources.view') and created_by=auth.uid());
create policy "Resource notes update own" on public.resource_discussion_notes for update to authenticated using(public.has_permission('resources.view') and created_by=auth.uid()) with check(public.has_permission('resources.view') and created_by=auth.uid());
create policy "Resource notes delete own" on public.resource_discussion_notes for delete to authenticated using(public.has_permission('resources.view') and created_by=auth.uid());
commit;
