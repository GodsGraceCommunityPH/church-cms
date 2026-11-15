-- Give the dedicated Project Ilaw Orders Staff role a narrowly-scoped
-- amendment permission. This does not grant general order management.
begin;

insert into public.permissions (code, name, module, description)
values (
  'project_ilaw.orders.amend_items',
  'Amend Project Ilaw order items',
  'project_ilaw',
  'Change quantities, colours, and T-shirt sizes on existing Project Ilaw order lines without changing customer details or products.'
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
  and p.code = 'project_ilaw.orders.amend_items'
on conflict do nothing;

update public.roles
set description =
  'View orders, confirm payments, create staff-assisted orders, update fulfillment, and amend existing line quantities/colours and T-shirt sizes only. No customer-detail changes, product changes, settings, exports, or production quantity management.'
where code = 'project_ilaw_orders_staff';

-- Keep the existing amendment RPC and audit history, but permit either:
-- * orders.manage: current full amendment capability; or
-- * orders.amend_items: line-item-only edits for the dedicated staff role.
--
-- The restricted permission is additionally enforced inside the SECURITY
-- DEFINER RPC. UI restrictions are not an authorization boundary.
do $$
declare
  function_definition text;
  original_guard text := $guard$
  if not public.has_permission('project_ilaw.orders.manage') then
    raise exception 'project_ilaw.orders.manage permission required' using errcode = '42501';
  end if;
$guard$;
  replacement_guard text := $guard$
  if not (
    public.has_permission('project_ilaw.orders.manage')
    or public.has_permission('project_ilaw.orders.amend_items')
  ) then
    raise exception 'Project Ilaw order amendment permission required' using errcode = '42501';
  end if;
$guard$;
  original_anchor text := $anchor$
  previous_snapshot := public.project_ilaw_order_snapshot(target.id);
  validated := public.project_ilaw_validated_items(p_items);
  snapshot_items := validated -> 'items';
$anchor$;
  replacement_anchor text := $anchor$
  previous_snapshot := public.project_ilaw_order_snapshot(target.id);
  validated := public.project_ilaw_validated_items(p_items);
  snapshot_items := validated -> 'items';

  -- Orders Staff may change quantity/colour and (for T-shirts) size only.
  -- Customer identity/notes, product identity, and the existing line count
  -- are immutable for this permission. Catalogue validation above also
  -- keeps eco bags at One Size and validates each product's allowed colours.
  if public.has_permission('project_ilaw.orders.amend_items')
     and not public.has_permission('project_ilaw.orders.manage') then
    if clean_name is distinct from target.customer_name
       or clean_mobile is distinct from target.mobile
       or clean_notes is distinct from nullif(btrim(coalesce(target.notes, '')), '') then
      raise exception 'Project Ilaw order staff cannot change customer details or order notes'
        using errcode = '42501';
    end if;

    if jsonb_array_length(snapshot_items) <> (
      select count(*)::integer
      from public.project_ilaw_order_items current_items
      where current_items.order_id = target.id
        and current_items.superseded_at is null
    ) then
      raise exception 'Project Ilaw order staff cannot add or remove order lines'
        using errcode = '42501';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(snapshot_items) with ordinality as submitted(value, position)
      left join public.project_ilaw_order_items current_items
        on current_items.order_id = target.id
       and current_items.superseded_at is null
       and current_items.line_number = submitted.position
      where current_items.id is null
         or current_items.product_id is distinct from submitted.value ->> 'product_id'
    ) then
      raise exception 'Project Ilaw order staff cannot change existing products'
        using errcode = '42501';
    end if;
  end if;
$anchor$;
begin
  function_definition := pg_get_functiondef(
    'public.amend_project_ilaw_order(uuid,text,text,text,jsonb,text)'::regprocedure
  );

  if position(original_guard in function_definition) = 0 then
    raise exception 'Expected amendment permission guard was not found; refusing to rewrite function';
  end if;
  if position(original_anchor in function_definition) = 0 then
    raise exception 'Expected amendment validation block was not found; refusing to rewrite function';
  end if;

  function_definition := replace(function_definition, original_guard, replacement_guard);
  function_definition := replace(function_definition, original_anchor, replacement_anchor);

  execute function_definition;
end
$$;

commit;
