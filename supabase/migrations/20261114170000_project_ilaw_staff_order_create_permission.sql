-- Allow the dedicated Project Ilaw Orders Staff role to create staff-assisted
-- orders without granting order management, fulfillment, settings, or export.
insert into public.permissions (code, name, module, description)
values (
  'project_ilaw.orders.create',
  'Create Project Ilaw staff orders',
  'project_ilaw',
  'Create staff-assisted Project Ilaw orders for customers.'
)
on conflict (code) do update
set name = excluded.name,
    module = excluded.module,
    description = excluded.description,
    updated_at = now();

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'project_ilaw_orders_staff'
  and p.code = 'project_ilaw.orders.create'
on conflict do nothing;

-- Enforce the dedicated permission in the security-definer creation RPC too;
-- UI visibility alone is never an authorization boundary.
do $$
declare
  function_definition text;
begin
  function_definition := pg_get_functiondef(
    'public.create_project_ilaw_staff_order(uuid,text,text,text,jsonb,text,text,text,boolean)'::regprocedure
  );

  if position('public.has_permission(''project_ilaw.orders.manage'')' in function_definition) = 0 then
    raise exception 'Expected staff-order manage permission guard was not found; refusing to rewrite function';
  end if;

  function_definition := replace(
    function_definition,
    'public.has_permission(''project_ilaw.orders.manage'')',
    'public.has_permission(''project_ilaw.orders.create'')'
  );
  function_definition := replace(
    function_definition,
    'project_ilaw.orders.manage permission required',
    'project_ilaw.orders.create permission required'
  );

  execute function_definition;
end
$$;
