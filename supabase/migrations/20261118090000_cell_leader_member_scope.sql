begin;

-- Cell Leaders can view only their own group and the unassigned member pool.
-- Other roles retain their existing church-wide member visibility.
create or replace function public.can_view_member_for_cell_scope(p_cell_group_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  viewer_member_id uuid;
  viewer_active boolean := false;
  viewer_is_cell_leader boolean := false;
begin
  if viewer_id is null then return false; end if;

  select u.member_id, u.is_active
    into viewer_member_id, viewer_active
  from public.users u where u.id = viewer_id;

  if not coalesce(viewer_active, false) then return false; end if;

  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = viewer_id and r.code = 'cell_leader'
  ) into viewer_is_cell_leader;

  if not viewer_is_cell_leader then
    return public.has_permission('members.view');
  end if;

  if not public.has_permission('members.view') then return false; end if;
  if p_cell_group_id is null then return true; end if;

  return exists (
    select 1 from public.cell_groups cg
    where cg.id = p_cell_group_id
      and cg.leader_member_id = viewer_member_id
  );
end;
$$;

revoke all on function public.can_view_member_for_cell_scope(uuid) from public, anon;
grant execute on function public.can_view_member_for_cell_scope(uuid) to authenticated;

drop policy if exists "Permitted member read" on public.members;
create policy "Members read within assigned cell scope"
on public.members for select to authenticated
using ((select public.can_view_member_for_cell_scope(cell_group_id)));

-- Cell Leaders should not be able to enumerate or inspect other cell groups.
drop policy if exists "Permitted cell group read" on public.cell_groups;
create policy "Cell groups read within assigned scope"
on public.cell_groups for select to authenticated
using (
  public.has_permission('cell_groups.view')
  and (
    not exists (
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid() and r.code = 'cell_leader'
    )
    or exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.is_active
        and public.cell_groups.leader_member_id = u.member_id
    )
  )
);

insert into public.permissions (code, name, module, description)
values ('cell_groups.assign_members', 'Assign existing unassigned members to own cell', 'cell_groups',
  'Allows Cell Leaders to add an existing unassigned member to the cell group they lead.')
on conflict (code) do update set
  name = excluded.name, module = excluded.module, description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.code = 'cell_leader' and p.code = 'cell_groups.assign_members'
on conflict (role_id, permission_id) do nothing;

-- Assignment is an RPC so the browser cannot change arbitrary member fields.
-- It accepts only an unassigned existing member and a group led by the caller.
create or replace function public.assign_unassigned_member_to_led_cell(
  p_member_id uuid,
  p_cell_group_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  viewer_member_id uuid;
  viewer_active boolean := false;
  target_group_id uuid;
begin
  if viewer_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select u.member_id, u.is_active
    into viewer_member_id, viewer_active
  from public.users u where u.id = viewer_id;

  if not coalesce(viewer_active, false) or viewer_member_id is null then
    raise exception 'Active Cell Leader account linked to a member profile required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = viewer_id and r.code = 'cell_leader'
  ) or not public.has_permission('cell_groups.assign_members') then
    raise exception 'Cell Leader assignment permission required' using errcode = '42501';
  end if;

  select cg.id into target_group_id
  from public.cell_groups cg
  where cg.id = p_cell_group_id
    and cg.leader_member_id = viewer_member_id
  for update;

  if target_group_id is null then
    raise exception 'You can only assign members to a cell group you lead' using errcode = '42501';
  end if;

  update public.members
  set cell_group_id = target_group_id
  where id = p_member_id and cell_group_id is null;

  if not found then
    if exists (select 1 from public.members where id = p_member_id) then
      raise exception 'This member is already assigned to a cell group. Refresh the list and try again.' using errcode = '23505';
    end if;
    raise exception 'Member not found or no longer available' using errcode = 'P0002';
  end if;

  return jsonb_build_object('status', 'assigned', 'member_id', p_member_id, 'cell_group_id', target_group_id);
end;
$$;

revoke all on function public.assign_unassigned_member_to_led_cell(uuid, uuid) from public, anon;
grant execute on function public.assign_unassigned_member_to_led_cell(uuid, uuid) to authenticated;

commit;
