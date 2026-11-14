begin;

insert into public.permissions (code, name, module, description)
values
  ('cell_groups.create', 'Create cell groups', 'cell_groups',
   'Allows Cell Leaders to create new cell groups without editing or deleting existing groups.'),
  ('cell_groups.assign_leaders', 'Assign cell group leaders', 'cell_groups',
   'Allows Cell Leaders to choose any existing church member as the leader of a newly created cell group.')
on conflict (code) do update set
  name = excluded.name,
  module = excluded.module,
  description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'cell_leader'
  and p.code in ('cell_groups.create', 'cell_groups.assign_leaders')
on conflict (role_id, permission_id) do nothing;

create or replace function public.get_cell_group_leader_candidates()
returns table (id uuid, first_name text, last_name text, mobile text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role('cell_leader')
     or not public.has_permission('cell_groups.create')
     or not public.has_permission('cell_groups.assign_leaders') then
    raise exception 'Cell group creation and leader assignment permissions required'
      using errcode = '42501';
  end if;

  return query
  select m.id, m.first_name, m.last_name, m.mobile
  from public.members m
  order by m.last_name, m.first_name;
end;
$$;

revoke all on function public.get_cell_group_leader_candidates() from public, anon;
grant execute on function public.get_cell_group_leader_candidates() to authenticated;

create or replace function public.create_cell_group_as_leader(
  p_name text,
  p_description text,
  p_status text,
  p_leader_member_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  viewer_active boolean := false;
  new_group_id uuid;
begin
  if viewer_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select u.is_active into viewer_active
  from public.users u where u.id = viewer_id;

  if not coalesce(viewer_active, false)
     or not public.has_role('cell_leader')
     or not public.has_permission('cell_groups.create')
     or not public.has_permission('cell_groups.assign_leaders') then
    raise exception 'Cell group creation and leader assignment permissions required'
      using errcode = '42501';
  end if;

  if p_name is null or btrim(p_name) = '' or char_length(btrim(p_name)) > 120 then
    raise exception 'Enter a valid cell group name (1–120 characters)' using errcode = '22023';
  end if;

  if p_status not in ('Active', 'Inactive') then
    raise exception 'Invalid cell group status' using errcode = '22023';
  end if;

  if p_leader_member_id is null or not exists (
    select 1 from public.members m where m.id = p_leader_member_id
  ) then
    raise exception 'Select an existing church member as the cell group leader' using errcode = '22023';
  end if;

  insert into public.cell_groups (
    name, description, status, leader_id, leader_member_id
  ) values (
    btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''),
    p_status, p_leader_member_id, p_leader_member_id
  )
  returning id into new_group_id;

  return new_group_id;
end;
$$;

revoke all on function public.create_cell_group_as_leader(text, text, text, uuid) from public, anon;
grant execute on function public.create_cell_group_as_leader(text, text, text, uuid) to authenticated;

commit;
