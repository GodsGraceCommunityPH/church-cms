select to_regclass('public.equipment_categories') as categories_table,
       to_regclass('public.equipment_items') as items_table,
       to_regclass('public.equipment_maintenance_history') as maintenance_table;

select code, module from public.permissions
where code in ('equipment.view', 'equipment.manage') order by code;

select role.code as role_code, permission.code as permission_code
from public.role_permissions assignment
join public.roles role on role.id = assignment.role_id
join public.permissions permission on permission.id = assignment.permission_id
where permission.code in ('equipment.view', 'equipment.manage')
order by role.code, permission.code;

select name, is_active from public.equipment_categories order by name;

select count(*) as equipment_items_should_be_zero from public.equipment_items;
select count(*) as maintenance_records_should_be_zero from public.equipment_maintenance_history;

select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('equipment_categories', 'equipment_items', 'equipment_maintenance_history')
order by tablename, policyname;
