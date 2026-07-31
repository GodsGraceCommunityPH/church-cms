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

insert into public.ministries (name, description)
values
  ('Music Team', 'Supports worship gatherings through music.'),
  ('CLAY (Christ Looks After You)', 'Serves children through Christ-centered care.'),
  ('Food Prep', 'Supports church gatherings through food preparation.'),
  ('Admin', 'Supports church administration and coordination.'),
  ('Finance', 'Supports responsible church financial administration.')
on conflict (name) do nothing;

insert into storage.buckets (id, name, public)
values ('ministry-pictures', 'ministry-pictures', true)
on conflict (id) do update set public = excluded.public;

create policy "Public ministry picture read"
on storage.objects for select
using (bucket_id = 'ministry-pictures');

create policy "Ministry picture upload"
on storage.objects for insert
with check (bucket_id = 'ministry-pictures');

create policy "Ministry picture update"
on storage.objects for update
using (bucket_id = 'ministry-pictures');

create policy "Ministry picture delete"
on storage.objects for delete
using (bucket_id = 'ministry-pictures');
