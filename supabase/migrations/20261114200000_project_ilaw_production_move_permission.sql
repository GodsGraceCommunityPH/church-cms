-- Allow Project Ilaw Orders Staff to move existing production quantities
-- between adjacent stages, without granting manual adjustments or review tools.
insert into public.permissions (code, name, module, description)
values (
  'project_ilaw.production.move',
  'Move Project Ilaw production quantities',
  'project_ilaw',
  'Move existing Project Ilaw quantities between adjacent production stages.'
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
  and p.code = 'project_ilaw.production.move'
on conflict do nothing;

do $$
declare
  function_definition text;
begin
  function_definition := pg_get_functiondef(
    'public.move_project_ilaw_production(uuid,integer,text,text,text)'::regprocedure
  );

  if position('public.has_permission(''project_ilaw.production.manage'')' in function_definition) = 0 then
    raise exception 'Expected production manage permission guard was not found; refusing to rewrite function';
  end if;

  function_definition := replace(
    function_definition,
    'public.has_permission(''project_ilaw.production.manage'')',
    'public.has_permission(''project_ilaw.production.move'')'
  );
  function_definition := replace(
    function_definition,
    'project_ilaw.production.manage permission required',
    'project_ilaw.production.move permission required'
  );

  execute function_definition;
end
$$;
