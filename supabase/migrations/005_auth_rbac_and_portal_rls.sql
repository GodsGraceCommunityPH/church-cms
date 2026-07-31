create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  display_name text not null,
  avatar_url text,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  module text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.users(id) on delete set null,
  unique (user_id, role_id)
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (role_id, permission_id)
);

insert into public.roles (code, name) values
  ('administrator', 'Administrator'),
  ('pastor', 'Pastor'),
  ('trainer', 'Trainer'),
  ('cell_leader', 'Cell Leader'),
  ('ministry_leader', 'Ministry Leader'),
  ('finance', 'Finance'),
  ('member', 'Member')
on conflict (code) do update set name = excluded.name;

insert into public.permissions (code, name, module) values
  ('members.view', 'View members', 'members'),
  ('members.create', 'Create members', 'members'),
  ('members.update', 'Update members', 'members'),
  ('members.archive', 'Archive members', 'members'),
  ('cell_groups.view', 'View cell groups', 'cell_groups'),
  ('cell_groups.manage', 'Manage cell groups', 'cell_groups'),
  ('training.view', 'View training', 'training'),
  ('training.create', 'Create training', 'training'),
  ('training.enroll', 'Manage enrollments', 'training'),
  ('training.attendance', 'Record attendance', 'training'),
  ('training.recommend', 'Recommend advancement', 'training'),
  ('training.complete', 'Complete training', 'training'),
  ('ministries.view', 'View ministries', 'ministries'),
  ('ministries.manage', 'Manage ministries', 'ministries'),
  ('finance.view', 'View finance', 'finance'),
  ('finance.create', 'Create finance records', 'finance'),
  ('finance.approve', 'Approve finance records', 'finance'),
  ('admin.users', 'Manage users', 'admin'),
  ('admin.roles', 'Manage roles', 'admin'),
  ('admin.permissions', 'Manage permissions', 'admin'),
  ('admin.settings', 'Manage settings', 'admin')
on conflict (code) do update
set name = excluded.name, module = excluded.module;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'administrator'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = any (case r.code
  when 'pastor' then array[
    'members.view', 'cell_groups.view', 'training.view',
    'ministries.view', 'finance.view'
  ]
  when 'trainer' then array[
    'members.view', 'training.view', 'training.attendance',
    'training.recommend', 'training.complete'
  ]
  when 'cell_leader' then array[
    'members.view', 'cell_groups.view', 'training.view'
  ]
  when 'ministry_leader' then array['members.view', 'ministries.view']
  when 'finance' then array['finance.view', 'finance.create']
  else array[]::text[]
end)
where r.code <> 'administrator'
on conflict (role_id, permission_id) do nothing;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Portal User'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

insert into public.users (id, display_name)
select
  id,
  coalesce(
    nullif(raw_user_meta_data ->> 'display_name', ''),
    nullif(split_part(email, '@', 1), ''),
    'Portal User'
  )
from auth.users
on conflict (id) do nothing;

create or replace function public.has_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    join public.user_roles ur on ur.user_id = u.id
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where u.id = auth.uid()
      and u.is_active
      and p.code = required_permission
  );
$$;

create or replace function public.get_my_permissions()
returns table (code text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct p.code
  from public.users u
  join public.user_roles ur on ur.user_id = u.id
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions p on p.id = rp.permission_id
  where u.id = auth.uid() and u.is_active;
$$;

revoke all on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to authenticated;
revoke all on function public.get_my_permissions() from public;
grant execute on function public.get_my_permissions() to authenticated;

do $$
begin
  if to_regprocedure('public.get_training_overview_stats()') is not null then
    execute 'revoke execute on function public.get_training_overview_stats() from anon';
    execute 'grant execute on function public.get_training_overview_stats() to authenticated';
  end if;
end;
$$;

alter table public.users enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.members enable row level security;
alter table public.cell_groups enable row level security;
alter table public.trainings enable row level security;
alter table public.member_trainings enable row level security;
alter table public.ministries enable row level security;
alter table public.ministry_members enable row level security;

revoke all on table public.users, public.roles, public.permissions,
  public.user_roles, public.role_permissions, public.members,
  public.cell_groups, public.trainings, public.member_trainings,
  public.ministries, public.ministry_members from anon;

grant select, update on public.users to authenticated;
grant select on public.roles, public.permissions,
  public.user_roles, public.role_permissions to authenticated;
grant select, insert, update on public.members to authenticated;
grant select, insert, update, delete on public.cell_groups to authenticated;
grant select, insert, update, delete on public.trainings to authenticated;
grant select, insert, update, delete on public.member_trainings to authenticated;
grant select, insert, update, delete on public.ministries to authenticated;
grant select, insert, update, delete on public.ministry_members to authenticated;

create policy "Users read own profile" on public.users
for select to authenticated using (id = auth.uid());
create policy "Users update own login time" on public.users
for update to authenticated using (id = auth.uid())
with check (id = auth.uid());

create policy "Authenticated users read assigned roles" on public.user_roles
for select to authenticated using (user_id = auth.uid());
create policy "Authenticated users read roles" on public.roles
for select to authenticated using (true);
create policy "Authenticated users read permissions" on public.permissions
for select to authenticated using (true);
create policy "Authenticated users read role permissions" on public.role_permissions
for select to authenticated using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role_id = role_permissions.role_id
  )
);

create policy "Permitted member read" on public.members
for select to authenticated using (public.has_permission('members.view'));
create policy "Permitted member create" on public.members
for insert to authenticated with check (public.has_permission('members.create'));
create policy "Permitted member update" on public.members
for update to authenticated using (public.has_permission('members.update'))
with check (public.has_permission('members.update'));

create policy "Permitted cell group read" on public.cell_groups
for select to authenticated using (public.has_permission('cell_groups.view'));
create policy "Permitted cell group manage" on public.cell_groups
for all to authenticated using (public.has_permission('cell_groups.manage'))
with check (public.has_permission('cell_groups.manage'));

create policy "Permitted training read" on public.trainings
for select to authenticated using (public.has_permission('training.view'));
create policy "Permitted enrollment read" on public.member_trainings
for select to authenticated using (public.has_permission('training.view'));
create policy "Permitted enrollment manage" on public.member_trainings
for all to authenticated using (public.has_permission('training.enroll'))
with check (public.has_permission('training.enroll'));

create policy "Permitted ministry read" on public.ministries
for select to authenticated using (public.has_permission('ministries.view'));
create policy "Permitted ministry manage" on public.ministries
for all to authenticated using (public.has_permission('ministries.manage'))
with check (public.has_permission('ministries.manage'));
create policy "Permitted ministry member read" on public.ministry_members
for select to authenticated using (public.has_permission('ministries.view'));
create policy "Permitted ministry member manage" on public.ministry_members
for all to authenticated using (public.has_permission('ministries.manage'))
with check (public.has_permission('ministries.manage'));

drop policy if exists "Ministry picture upload" on storage.objects;
drop policy if exists "Ministry picture update" on storage.objects;
drop policy if exists "Ministry picture delete" on storage.objects;
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
);
create policy "Permitted ministry picture delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'ministry-pictures'
  and public.has_permission('ministries.manage')
);

-- Bootstrap an existing Supabase Auth user as Administrator after applying:
-- insert into public.user_roles (user_id, role_id)
-- select au.id, r.id
-- from auth.users au cross join public.roles r
-- where au.email = 'replace-with-admin-email@example.com'
--   and r.code = 'administrator'
-- on conflict (user_id, role_id) do nothing;
