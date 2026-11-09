-- Adds a dedicated permission for Member exports.
-- Only staff roles receive it initially. Cell Leaders are intentionally excluded.

begin;

insert into public.permissions (code, name, module) values
  ('members.export', 'Export members', 'members')
on conflict (code) do update
set name = excluded.name,
    module = excluded.module;

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles role
join public.permissions permission on permission.code = 'members.export'
where role.code in ('administrator', 'pastor')
on conflict (role_id, permission_id) do nothing;

-- Keep the permission limited to staff even if a role was granted it earlier.
delete from public.role_permissions role_permission
using public.roles role, public.permissions permission
where role_permission.role_id = role.id
  and role_permission.permission_id = permission.id
  and permission.code = 'members.export'
  and role.code not in ('administrator', 'pastor');

commit;
