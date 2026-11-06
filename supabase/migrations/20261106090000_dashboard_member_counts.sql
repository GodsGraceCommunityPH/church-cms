begin;

-- Dashboard totals must not depend on the caller's Members RLS visibility.
-- Cell Leaders only see their assigned Cell Group through RLS, so a plain
-- count of `members` would silently report the Cell Group total as the
-- church-wide total. This aggregate-only function is the single source of
-- truth for the dashboard cards. It never returns individual member data.
create or replace function public.get_dashboard_member_counts()
returns table (
  total_members bigint,
  your_cell_group_members bigint,
  is_cell_leader boolean,
  can_view_member_counts boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  viewer_member_id uuid;
  viewer_is_active boolean := false;
  viewer_is_cell_leader boolean := false;
  viewer_can_view boolean := false;
  viewer_total_members bigint := 0;
  viewer_group_members bigint := 0;
begin
  if viewer_id is not null then
    select u.member_id, u.is_active
      into viewer_member_id, viewer_is_active
    from public.users u
    where u.id = viewer_id;
  end if;

  if coalesce(viewer_is_active, false) then
    select exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = viewer_id
        and r.code = 'cell_leader'
    ) into viewer_is_cell_leader;

    viewer_can_view := public.has_permission('members.view')
      or public.has_permission('admin.users');
  end if;

  if viewer_can_view then
    select count(*) into viewer_total_members from public.members;
  end if;

  if viewer_can_view and viewer_is_cell_leader and viewer_member_id is not null then
    select count(*)
      into viewer_group_members
    from public.cell_groups cg
    join public.members m on m.cell_group_id = cg.id
    where cg.leader_member_id = viewer_member_id;
  end if;

  return query
  select
    case when viewer_can_view then viewer_total_members else null end,
    case when viewer_can_view and viewer_is_cell_leader then viewer_group_members else null end,
    viewer_is_cell_leader,
    viewer_can_view;
end;
$$;

revoke all on function public.get_dashboard_member_counts() from public, anon;
grant execute on function public.get_dashboard_member_counts() to authenticated;

comment on function public.get_dashboard_member_counts() is
  'Aggregate-only dashboard member counts. Church-wide total is visible only to active CMS users with members.view or admin.users. Cell Group total is returned only for Cell Leaders and is scoped to the group they lead.';

commit;
