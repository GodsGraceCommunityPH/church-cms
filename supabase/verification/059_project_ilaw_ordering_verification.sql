-- Project Ilaw Phase 2 verification.
-- Read-only checks: every assertion runs inside a transaction that is rolled
-- back, so applying this file to a database makes no lasting change.
--
-- Run against the target database after applying
-- 20261110090000_project_ilaw_ordering.sql, for example:
--   psql "$DATABASE_URL" -f supabase/verification/059_project_ilaw_ordering_verification.sql

begin;

do $$
declare
  expected_permissions text[] := array[
    'project_ilaw.orders.view',
    'project_ilaw.orders.confirm_payment',
    'project_ilaw.orders.manage',
    'project_ilaw.orders.export'
  ];
  missing_permissions text[];
  staff_permissions text[];
  admin_permission_count integer;
  unexpected_role_count integer;
  table_name text;
  settings_row public.project_ilaw_settings%rowtype;
begin
  select array_agg(expected.code order by expected.code) into missing_permissions
  from unnest(expected_permissions) as expected(code)
  where not exists (
    select 1 from public.permissions where permissions.code = expected.code
  );

  if missing_permissions is not null then
    raise exception 'Missing Project Ilaw permissions: %', missing_permissions;
  end if;

  select array_agg(permission.code order by permission.code)
  into staff_permissions
  from public.roles role
  join public.role_permissions role_permission
    on role_permission.role_id = role.id
  join public.permissions permission
    on permission.id = role_permission.permission_id
  where role.code = 'project_ilaw_orders_staff'
    and permission.code like 'project_ilaw.orders.%';

  if staff_permissions is distinct from array[
    'project_ilaw.orders.confirm_payment',
    'project_ilaw.orders.view'
  ] then
    raise exception 'project_ilaw_orders_staff must hold exactly view + confirm_payment, found %',
      coalesce(staff_permissions::text, 'no role or permissions');
  end if;

  select count(*) into admin_permission_count
  from public.roles role
  join public.role_permissions role_permission
    on role_permission.role_id = role.id
  join public.permissions permission
    on permission.id = role_permission.permission_id
  where role.code = 'administrator'
    and permission.code like 'project_ilaw.orders.%';

  if admin_permission_count <> 4 then
    raise exception 'Administrator must hold all four Project Ilaw permissions, found %',
      admin_permission_count;
  end if;

  select count(*) into unexpected_role_count
  from public.roles role
  join public.role_permissions role_permission
    on role_permission.role_id = role.id
  join public.permissions permission
    on permission.id = role_permission.permission_id
  where permission.code like 'project_ilaw.orders.%'
    and role.code not in ('administrator', 'project_ilaw_orders_staff');

  if unexpected_role_count <> 0 then
    raise exception '% unexpected role(s) hold Project Ilaw permissions',
      unexpected_role_count;
  end if;

  foreach table_name in array array[
    'project_ilaw_orders',
    'project_ilaw_order_items',
    'project_ilaw_order_events',
    'project_ilaw_settings'
  ] loop
    if not exists (
      select 1
      from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = table_name
        and relation.relrowsecurity
    ) then
      raise exception 'RLS is not enabled on public.%', table_name;
    end if;

    if has_table_privilege('anon', format('public.%I', table_name), 'select') then
      raise exception 'anon must not be able to read public.%', table_name;
    end if;

    if has_table_privilege('authenticated', format('public.%I', table_name), 'insert')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'update')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'delete') then
      raise exception 'authenticated must not write public.% directly', table_name;
    end if;

    if not has_table_privilege('authenticated', format('public.%I', table_name), 'select') then
      raise exception 'authenticated must be able to select public.% through RLS', table_name;
    end if;
  end loop;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_ilaw_orders'
      and policyname = 'Project Ilaw viewers read orders'
      and cmd = 'SELECT'
  ) then
    raise exception 'Missing RLS policy on project_ilaw_orders';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_ilaw_order_items'
      and policyname = 'Project Ilaw viewers read order items'
      and cmd = 'SELECT'
  ) then
    raise exception 'Missing RLS policy on project_ilaw_order_items';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_ilaw_order_events'
      and policyname = 'Project Ilaw viewers read order activity'
      and cmd = 'SELECT'
  ) then
    raise exception 'Missing RLS policy on project_ilaw_order_events';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_ilaw_settings'
      and policyname = 'Project Ilaw viewers read settings'
      and cmd = 'SELECT'
  ) then
    raise exception 'Missing RLS policy on project_ilaw_settings';
  end if;

  if not has_function_privilege(
    'anon',
    'public.submit_project_ilaw_order(uuid,text,text,text,jsonb)',
    'execute'
  ) then
    raise exception 'anon must be able to submit an order';
  end if;

  if not has_function_privilege(
    'anon',
    'public.get_project_ilaw_payment_context(text,text)',
    'execute'
  ) then
    raise exception 'anon must be able to look up their own order with reference + mobile';
  end if;

  if not has_function_privilege(
    'anon',
    'public.submit_project_ilaw_payment(text,text,uuid,text,text)',
    'execute'
  ) then
    raise exception 'anon must be able to submit payment evidence';
  end if;

  if not has_function_privilege(
    'anon',
    'public.get_project_ilaw_payment_instructions()',
    'execute'
  ) then
    raise exception 'anon must be able to read enabled payment instructions';
  end if;

  if not has_function_privilege(
    'anon',
    'public.get_project_ilaw_public_settings()',
    'execute'
  ) then
    raise exception 'anon must be able to read the public ordering and payment status';
  end if;

  if has_function_privilege(
    'anon',
    'public.confirm_project_ilaw_payment(uuid,text)',
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.reject_project_ilaw_payment(uuid,text)',
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.update_project_ilaw_fulfillment(uuid,text,text)',
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.amend_project_ilaw_order(uuid,text,text,text,jsonb,text)',
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.project_ilaw_export_rows(date,date,text,text,text)',
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.project_ilaw_production_report(date)',
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.update_project_ilaw_settings(boolean,boolean,text,text,text,text,text,text,date)',
    'execute'
  ) then
    raise exception 'anon must not execute privileged Project Ilaw functions';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.confirm_project_ilaw_payment(uuid,text)',
    'execute'
  ) then
    raise exception 'authenticated calls must route through confirm_project_ilaw_payment';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'project_ilaw_order_events_append_only'
      and not tgisinternal
  ) then
    raise exception 'Missing append-only trigger on project_ilaw_order_events';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'project_ilaw_order_items_totals_check'
      and not tgisinternal
  ) then
    raise exception 'Missing deferred line-item total verification trigger';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'notifications_event_type_check'
      and pg_get_constraintdef(oid) like '%project_ilaw_order_created%'
  ) then
    raise exception 'notifications.event_type does not allow project_ilaw_order_created';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'notifications_event_type_check'
      and pg_get_constraintdef(oid) like '%project_ilaw_payment_submitted%'
  ) then
    raise exception 'notifications.event_type does not allow project_ilaw_payment_submitted';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name = 'related_order_id'
  ) then
    raise exception 'notifications.related_order_id is missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'project_ilaw_order_items'
      and column_name = 'color'
      and is_nullable = 'NO'
  ) then
    raise exception 'project_ilaw_order_items.color is missing or nullable';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'project_ilaw_settings'
      and column_name = 'orders_enabled'
      and is_nullable = 'NO'
      and column_default = 'false'
  ) then
    raise exception 'project_ilaw_settings.orders_enabled is missing, nullable, or not defaulting to false';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'project_ilaw_orders_payment_status_check'
      and pg_get_constraintdef(oid) like '%payment_verification%'
      and pg_get_constraintdef(oid) like '%paid%'
  ) then
    raise exception 'payment status must support awaiting_payment, payment_verification, and paid';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'project_ilaw_orders_fulfillment_status_check'
      and pg_get_constraintdef(oid) like '%in_production%'
  ) then
    raise exception 'fulfillment status must support in_production';
  end if;

  select * into settings_row from public.project_ilaw_settings where id;
  if not found then
    raise exception 'Project Ilaw settings singleton row is missing';
  end if;
  if settings_row.orders_enabled then
    raise exception 'Public ordering must start disabled until the church authorizes order intake';
  end if;
  if settings_row.payments_enabled then
    raise exception 'Payments must start disabled until official account details are provided';
  end if;
  if settings_row.production_cutoff is not null then
    raise exception 'Production cutoff must start unset until leadership decides the date';
  end if;

  -- The submission function itself must reject orders while ordering is closed,
  -- even if a caller bypasses the Shop interface.
  begin
    perform public.submit_project_ilaw_order(
      gen_random_uuid(),
      'Verification Test',
      '09171234567',
      null,
      '[{"productId":"project-ilaw-t-shirt","size":"M","color":"Black","quantity":1}]'::jsonb
    );
    raise exception 'Order submission succeeded while public ordering is disabled';
  exception
    when others then
      if sqlerrm not like '%ordering is not open yet%' then
        raise;
      end if;
  end;

  if not exists (
    select 1 from storage.buckets buckets
    where buckets.id = 'project-ilaw-payment-evidence'
      and buckets."public" = false
  ) then
    raise exception 'Private payment evidence bucket is missing or public';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Project Ilaw payment evidence upload'
      and cmd = 'INSERT'
  ) then
    raise exception 'Missing storage upload policy for payment evidence';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Project Ilaw staff read payment evidence'
      and cmd = 'SELECT'
  ) then
    raise exception 'Missing storage read policy for payment evidence';
  end if;

  raise notice 'Project Ilaw Phase 2 verification passed.';
end $$;

rollback;
