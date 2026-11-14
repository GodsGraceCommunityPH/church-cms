begin;

-- A Cell Leader who created/oversees a group and the designated leader
-- can both view that group's members and add unassigned members to it.
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
  select u.member_id,u.is_active into viewer_member_id,viewer_active
  from public.users u where u.id=viewer_id;
  if not coalesce(viewer_active,false) then return false; end if;
  if public.has_permission('admin.users') then return true; end if;

  select exists(
    select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
    where ur.user_id=viewer_id and r.code='cell_leader'
  ) into viewer_is_cell_leader;

  if not viewer_is_cell_leader then return public.has_permission('members.view'); end if;
  if not public.has_permission('members.view') then return false; end if;
  if p_cell_group_id is null then return true; end if;

  return exists(
    select 1 from public.cell_groups cg
    where cg.id=p_cell_group_id
      and (cg.leader_member_id=viewer_member_id or cg.created_by=viewer_id)
  );
end;
$$;

revoke all on function public.can_view_member_for_cell_scope(uuid) from public,anon;
grant execute on function public.can_view_member_for_cell_scope(uuid) to authenticated;

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
  viewer_is_cell_leader boolean := false;
  viewer_can_manage_groups boolean := false;
  target_group_id uuid;
begin
  if viewer_id is null then raise exception 'Authentication required' using errcode='42501'; end if;

  select u.member_id,u.is_active into viewer_member_id,viewer_active
  from public.users u where u.id=viewer_id;
  if not coalesce(viewer_active,false) then
    raise exception 'An active CMS account is required' using errcode='42501';
  end if;

  select exists(
    select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
    where ur.user_id=viewer_id and r.code='cell_leader'
  ) into viewer_is_cell_leader;
  viewer_can_manage_groups:=public.has_permission('cell_groups.manage');

  if viewer_is_cell_leader and public.has_permission('cell_groups.assign_members') then
    select cg.id into target_group_id from public.cell_groups cg
    where cg.id=p_cell_group_id
      and (cg.leader_member_id=viewer_member_id or cg.created_by=viewer_id)
    for update;
    if target_group_id is null then
      raise exception 'You can only add members to a cell group you lead or created' using errcode='42501';
    end if;
  elsif viewer_can_manage_groups then
    select cg.id into target_group_id from public.cell_groups cg
    where cg.id=p_cell_group_id for update;
    if target_group_id is null then
      raise exception 'Cell group not found' using errcode='P0002';
    end if;
  else
    raise exception 'Cell group assignment permission required' using errcode='42501';
  end if;

  update public.members set cell_group_id=target_group_id
  where id=p_member_id and cell_group_id is null;

  if not found then
    if exists(select 1 from public.members where id=p_member_id) then
      raise exception 'This member is already assigned to a cell group. Refresh the list and try again.' using errcode='23505';
    end if;
    raise exception 'Member not found or no longer available' using errcode='P0002';
  end if;

  return jsonb_build_object('status','assigned','member_id',p_member_id,'cell_group_id',target_group_id);
end;
$$;

revoke all on function public.assign_unassigned_member_to_led_cell(uuid,uuid) from public,anon;
grant execute on function public.assign_unassigned_member_to_led_cell(uuid,uuid) to authenticated;

commit;