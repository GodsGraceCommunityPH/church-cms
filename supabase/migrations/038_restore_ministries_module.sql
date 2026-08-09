begin;

-- Production never received the original Ministries schema. Recreate only the
-- two tables and storage bucket expected by the existing portal code.
create table if not exists public.ministries (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  picture_path text,
  status text not null default 'Active'
    check (status in ('Active', 'Inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ministry_members (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  role text not null default 'Member'
    check (role in ('Leader', 'Assistant Leader', 'Member')),
  date_joined date not null default current_date,
  status text not null default 'Active'
    check (status in ('Active', 'Inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ministry_id, member_id)
);

create index if not exists idx_ministry_members_ministry_id
  on public.ministry_members(ministry_id);
create index if not exists idx_ministry_members_member_id
  on public.ministry_members(member_id);

insert into storage.buckets (id, name, public)
values ('ministry-pictures', 'ministry-pictures', true)
on conflict (id) do update set public = excluded.public;

alter table public.ministries enable row level security;
alter table public.ministry_members enable row level security;

revoke all on public.ministries, public.ministry_members from anon;
grant select, insert, update, delete on public.ministries to authenticated;
grant select, insert, update, delete on public.ministry_members to authenticated;

drop policy if exists "Permitted ministry read" on public.ministries;
drop policy if exists "Permitted ministry manage" on public.ministries;
create policy "Permitted ministry read"
on public.ministries for select to authenticated
using (public.has_permission('ministries.view'));
create policy "Permitted ministry manage"
on public.ministries for all to authenticated
using (public.has_permission('ministries.manage'))
with check (public.has_permission('ministries.manage'));

drop policy if exists "Permitted ministry member read" on public.ministry_members;
drop policy if exists "Permitted ministry member manage" on public.ministry_members;
create policy "Permitted ministry member read"
on public.ministry_members for select to authenticated
using (public.has_permission('ministries.view'));
create policy "Permitted ministry member manage"
on public.ministry_members for all to authenticated
using (public.has_permission('ministries.manage'))
with check (public.has_permission('ministries.manage'));

drop policy if exists "Public ministry picture read" on storage.objects;
drop policy if exists "Ministry picture upload" on storage.objects;
drop policy if exists "Ministry picture update" on storage.objects;
drop policy if exists "Ministry picture delete" on storage.objects;
drop policy if exists "Permitted ministry picture upload" on storage.objects;
drop policy if exists "Permitted ministry picture update" on storage.objects;
drop policy if exists "Permitted ministry picture delete" on storage.objects;

create policy "Public ministry picture read"
on storage.objects for select
using (bucket_id = 'ministry-pictures');
create policy "Permitted ministry picture upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ministry-pictures'
  and public.has_permission('ministries.manage')
);
create policy "Permitted ministry picture update"
on storage.objects for update to authenticated
using (
  bucket_id = 'ministry-pictures'
  and public.has_permission('ministries.manage')
)
with check (
  bucket_id = 'ministry-pictures'
  and public.has_permission('ministries.manage')
);
create policy "Permitted ministry picture delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'ministry-pictures'
  and public.has_permission('ministries.manage')
);

commit;
