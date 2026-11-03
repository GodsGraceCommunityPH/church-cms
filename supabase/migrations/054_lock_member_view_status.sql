begin;

revoke insert, update on public.member_admin_views from authenticated;
grant update (viewed_at) on public.member_admin_views to authenticated;

drop policy if exists "Member viewers record own member view status" on public.member_admin_views;
drop policy if exists "Member viewers update own member view status" on public.member_admin_views;
create policy "Member viewers update own member view status" on public.member_admin_views
for update to authenticated using (
  admin_id = auth.uid() and public.has_permission('members.view')
) with check (
  admin_id = auth.uid() and public.has_permission('members.view') and viewed_at is not null
);

commit;
