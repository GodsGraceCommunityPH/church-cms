-- Allow Project Ilaw Orders Staff to advance fulfillment without granting
-- order amendment, settings, export, or production quantity management.
insert into public.permissions (code, name, module, description)
values (
  'project_ilaw.orders.fulfill',
  'Update Project Ilaw order fulfillment',
  'project_ilaw',
  'Advance Project Ilaw orders through production, pickup, completion, or cancellation.'
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
  and p.code = 'project_ilaw.orders.fulfill'
on conflict do nothing;

-- The RPC remains the authorization boundary. Replace only its permission
-- check; preserve its existing transition validation and production sync logic.
do $$
declare
  function_definition text;
begin
  function_definition := pg_get_functiondef(
    'public.update_project_ilaw_fulfillment(uuid,text,text)'::regprocedure
  );

  if position('public.has_permission(''project_ilaw.orders.manage'')' in function_definition) = 0 then
    raise exception 'Expected fulfillment manage permission guard was not found; refusing to rewrite function';
  end if;

  function_definition := replace(
    function_definition,
    'public.has_permission(''project_ilaw.orders.manage'')',
    'public.has_permission(''project_ilaw.orders.fulfill'')'
  );
  function_definition := replace(
    function_definition,
    'project_ilaw.orders.manage permission required',
    'project_ilaw.orders.fulfill permission required'
  );

  execute function_definition;
end
$$;
