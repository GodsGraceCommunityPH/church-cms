-- Project Ilaw: persist the customer's selected payment method at order creation.
begin;

alter table public.project_ilaw_orders
  add column if not exists payment_method text,
  add column if not exists payment_amount_received integer;

do $$
begin
  alter table public.project_ilaw_orders
    add constraint project_ilaw_orders_payment_method_check
    check (payment_method is null or payment_method in ('gcash', 'cash'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.project_ilaw_orders
    add constraint project_ilaw_orders_payment_amount_received_check
    check (payment_amount_received is null or payment_amount_received > 0);
exception when duplicate_object then null;
end $$;

-- New six-argument RPC. The old five-argument signature remains available for
-- compatibility and continues to create legacy orders with no selected method.
create or replace function public.submit_project_ilaw_order(
  p_request_id uuid,
  p_customer_name text,
  p_mobile text,
  p_notes text,
  p_items jsonb,
  p_payment_method text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.project_ilaw_orders%rowtype;
  created public.project_ilaw_orders%rowtype;
  settings public.project_ilaw_settings%rowtype;
  validated jsonb;
  snapshot_items jsonb;
  line_number integer := 0;
  item jsonb;
  recipient uuid;
  clean_name text := btrim(coalesce(p_customer_name, ''));
  clean_mobile text := btrim(coalesce(p_mobile, ''));
  clean_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  clean_method text := lower(btrim(coalesce(p_payment_method, '')));
  digits text;
begin
  if p_request_id is null then
    raise exception 'A request identifier is required' using errcode = '22023';
  end if;
  if clean_method not in ('gcash', 'cash') then
    raise exception 'Choose GCash or cash as the payment method' using errcode = '22023';
  end if;

  select * into settings from public.project_ilaw_settings where id;
  if not found or not settings.orders_enabled then
    raise exception 'Project Ilaw ordering is not open yet' using errcode = 'P0001';
  end if;
  if clean_name = '' or char_length(clean_name) > 120 then
    raise exception 'Customer name is required and must be at most 120 characters' using errcode = '22023';
  end if;
  digits := regexp_replace(clean_mobile, '[^0-9]', '', 'g');
  if clean_mobile = '' or char_length(clean_mobile) > 32
     or char_length(digits) < 10 or char_length(digits) > 15 then
    raise exception 'A valid mobile number is required' using errcode = '22023';
  end if;
  if clean_notes is not null and char_length(clean_notes) > 1000 then
    raise exception 'Order notes must be at most 1000 characters' using errcode = '22023';
  end if;

  validated := public.project_ilaw_validated_items(p_items);
  snapshot_items := validated -> 'items';

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into existing from public.project_ilaw_orders
  where client_request_id = p_request_id;

  if found then
    if existing.payment_method is distinct from clean_method then
      raise exception 'This order request was already submitted with a different payment method' using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'order_id', existing.id, 'reference', existing.reference,
      'payment_token', existing.payment_token,
      'total_quantity', existing.total_quantity, 'total_amount', existing.total_amount,
      'payment_status', existing.payment_status, 'fulfillment_status', existing.fulfillment_status,
      'payment_method', existing.payment_method, 'created_at', existing.created_at,
      'duplicate', true
    );
  end if;

  insert into public.project_ilaw_orders (
    client_request_id, reference, customer_name, mobile, notes,
    total_quantity, total_amount, payment_method
  ) values (
    p_request_id, public.next_project_ilaw_order_reference(), clean_name,
    clean_mobile, clean_notes, (validated ->> 'total_quantity')::integer,
    (validated ->> 'total_amount')::integer, clean_method
  ) returning * into created;

  for item in select value from jsonb_array_elements(snapshot_items)
  loop
    line_number := line_number + 1;
    insert into public.project_ilaw_order_items (
      order_id, revision, line_number, product_id, product_name, product_type,
      size, color, quantity, unit_price
    ) values (
      created.id, 1, line_number, item ->> 'product_id', item ->> 'product_name',
      item ->> 'product_type', item ->> 'size', item ->> 'color',
      (item ->> 'quantity')::integer, 499
    );
  end loop;

  insert into public.project_ilaw_order_events (
    order_id, event_type, actor_id, actor_type, new_value
  ) values (
    created.id, 'order_created', null, 'anonymous',
    jsonb_build_object(
      'customer_name', created.customer_name, 'mobile', created.mobile,
      'notes', created.notes, 'total_quantity', created.total_quantity,
      'total_amount', created.total_amount, 'payment_method', created.payment_method,
      'items', snapshot_items
    )
  );

  for recipient in
    select distinct users.id
    from public.users users
    join public.user_roles user_roles on user_roles.user_id = users.id
    join public.role_permissions role_permissions on role_permissions.role_id = user_roles.role_id
    join public.permissions permissions on permissions.id = role_permissions.permission_id
    where users.is_active and permissions.code = 'project_ilaw.orders.view'
  loop
    insert into public.notifications (
      recipient_id, event_type, title, message, related_order_id
    ) values (
      recipient, 'project_ilaw_order_created', 'New Project Ilaw Order',
      'Order ' || created.reference || ' from ' || created.customer_name
        || ' (' || created.total_quantity || ' item'
        || case when created.total_quantity = 1 then '' else 's' end
        || ', ₱' || created.total_amount || ').',
      created.id
    );
  end loop;

  return jsonb_build_object(
    'order_id', created.id, 'reference', created.reference,
    'payment_token', created.payment_token,
    'total_quantity', created.total_quantity, 'total_amount', created.total_amount,
    'payment_status', created.payment_status, 'fulfillment_status', created.fulfillment_status,
    'payment_method', created.payment_method, 'created_at', created.created_at,
    'duplicate', false
  );
end;
$$;

revoke all on function public.submit_project_ilaw_order(uuid, text, text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.submit_project_ilaw_order(uuid, text, text, text, jsonb, text)
  to anon, authenticated;

commit;
