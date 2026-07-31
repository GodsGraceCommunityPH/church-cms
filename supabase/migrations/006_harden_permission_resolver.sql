revoke all on function public.get_my_permissions() from public;
revoke all on function public.get_my_permissions() from anon;
grant execute on function public.get_my_permissions() to authenticated;

revoke all on function public.has_permission(text) from public;
revoke all on function public.has_permission(text) from anon;
grant execute on function public.has_permission(text) to authenticated;

grant usage on schema public to authenticated;
grant select on public.users to authenticated;
grant select on public.user_roles to authenticated;
grant select on public.roles to authenticated;
grant select on public.role_permissions to authenticated;
grant select on public.permissions to authenticated;
