-- Staff-assisted Project Ilaw order creation.
--
-- Adds the order source switch used to distinguish online customer-submitted
-- orders from staff-assisted orders (Facebook Messenger, personal messages,
-- walk-in requests, and other offline conversations).
alter table public.project_ilaw_orders
  add column if not exists source text not null default 'online';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_ilaw_orders_source_check'
  ) then
    alter table public.project_ilaw_orders
      add constraint project_ilaw_orders_source_check
      check (source in ('online', 'staff'));
  end if;
end
$$;

-- Staff-assisted orders may be created without a customer mobile number.
alter table public.project_ilaw_orders
  alter column mobile drop not null;

alter table public.project_ilaw_orders
  drop constraint if exists project_ilaw_orders_mobile_check;

alter table public.project_ilaw_orders
  add constraint project_ilaw_orders_mobile_check
  check (mobile is null or btrim(mobile) <> '');

-- Staff-assisted order creation with optional GCash evidence or cash handling.
create or replace function public.create_project_ilaw_staff_order(
  p_request_id uuid,
  p_customer_name text,
  p_mobile text,
  p_notes text,
  p_items jsonb,
  p_payment_method text default 'unpaid',
  p_payment_reference text default null,
  p_evidence_path text default null,
  p_confirmed_received boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  created public.project_ilaw_orders%rowtype;
  validated jsonb;
  snapshot_items jsonb;
  line_number integer := 0;
  item jsonb;
  actor uuid := auth.uid();
  clean_name text := btrim(coalesce(p_customer_name, ''));
  clean_mobile text := nullif(btrim(coalesce(p_mobile, '')), '');
  clean_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  clean_payment_method text := btrim(coalesce(p_payment_method, 'unpaid'));
  clean_payment_reference text := nullif(btrim(coalesce(p_payment_reference, '')), '');
  clean_evidence_path text := nullif(btrim(coalesce(p_evidence_path, '')), '');
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.has_permission('project_ilaw.orders.manage') then
    raise exception 'project_ilaw.orders.manage permission required' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'A request identifier is required' using errcode = '22023';
  end if;

  if clean_name = '' or char_length(clean_name) > 120 then
    raise exception 'Customer name is required and must be at most 120 characters' using errcode = '22023';
  end if;

  if clean_mobile is not null and (
    char_length(clean_mobile) > 32
    or char_length(regexp_replace(clean_mobile, '[^0-9]', '', 'g')) < 10
    or char_length(regexp_replace(clean_mobile, '[^0-9]', '', 'g')) > 15
  ) then
    raise exception 'A valid mobile number is required' using errcode = '22023';
  end if;

  if clean_notes is not null and char_length(clean_notes) > 1000 then
    raise exception 'Order notes must be at most 1000 characters' using errcode = '22023';
  end if;

  if clean_payment_method not in ('unpaid', 'gcash', 'cash') then
    raise exception 'Unsupported payment method' using errcode = '22023';
  end if;

  -- A GCash order needs the mobile number later used to match the receipt
  -- against the order. Validate it before the order is inserted so a failed
  -- payment step never leaves a half-configured order behind.
  if clean_payment_method = 'gcash' and clean_mobile is null then
    raise exception 'A mobile number is required for GCash staff orders' using errcode = '22023';
  end if;

  validated := public.project_ilaw_validated_items(p_items);
  snapshot_items := validated -> 'items';

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));

  if exists (select 1 from public.project_ilaw_orders where client_request_id = p_request_id) then
    select * into created
    from public.project_ilaw_orders
    where client_request_id = p_request_id;
    return jsonb_build_object(
      'order_id', created.id,
      'reference', created.reference,
      'payment_token', created.payment_token,
      'total_quantity', created.total_quantity,
      'total_amount', created.total_amount,
      'payment_status', created.payment_status,
      'fulfillment_status', created.fulfillment_status,
      'created_at', created.created_at,
      'duplicate', true
    );
  end if;

  insert into public.project_ilaw_orders (
    client_request_id,
    reference,
    customer_name,
    mobile,
    notes,
    total_quantity,
    total_amount,
    source,
    payment_method
  ) values (
    p_request_id,
    public.next_project_ilaw_order_reference(),
    clean_name,
    clean_mobile,
    clean_notes,
    (validated ->> 'total_quantity')::integer,
    (validated ->> 'total_amount')::integer,
    'staff',
    case clean_payment_method
      when 'gcash' then 'gcash'
      when 'cash' then 'cash'
      else null
    end
  )
  returning * into created;

  for item in select value from jsonb_array_elements(snapshot_items)
  loop
    line_number := line_number + 1;
    insert into public.project_ilaw_order_items (
      order_id,
      revision,
      line_number,
      product_id,
      product_name,
      product_type,
      size,
      color,
      quantity,
      unit_price
    ) values (
      created.id,
      1,
      line_number,
      item ->> 'product_id',
      item ->> 'product_name',
      item ->> 'product_type',
      item ->> 'size',
      item ->> 'color',
      (item ->> 'quantity')::integer,
      (item ->> 'unit_price')::integer
    );
  end loop;

  insert into public.project_ilaw_order_events (
    order_id,
    event_type,
    actor_id,
    actor_type,
    new_value
  ) values (
    created.id,
    'order_created',
    actor,
    'user',
    jsonb_build_object(
      'source', 'staff',
      'customer_name', created.customer_name,
      'mobile', created.mobile,
      'notes', created.notes,
      'total_quantity', created.total_quantity,
      'total_amount', created.total_amount,
      'items', snapshot_items
    )
  );

  -- The payment method above records the staff member's intent. Evidence is
  -- optional in this call because the receipt file can only be uploaded after
  -- the order (and its payment token) exists; the client then uses the existing
  -- evidence and payment functions. When evidence or a cash confirmation is
  -- supplied up front, use those same existing paths here.
  if clean_payment_method = 'gcash'
     and (clean_payment_reference is not null or clean_evidence_path is not null) then
    if clean_payment_reference is null or char_length(clean_payment_reference) < 4 or char_length(clean_payment_reference) > 120 then
      raise exception 'Enter the transaction reference from your payment receipt' using errcode = '22023';
    end if;
    if clean_evidence_path is null or clean_evidence_path = '' or position('..' in clean_evidence_path) > 0 then
      raise exception 'Payment evidence path is invalid' using errcode = '22023';
    end if;
    if clean_evidence_path not like ('orders/' || created.id::text || '/' || created.payment_token::text || '/%') then
      raise exception 'Payment evidence does not belong to this order' using errcode = '42501';
    end if;

    perform public.submit_project_ilaw_payment(
      created.reference,
      clean_mobile,
      created.payment_token,
      clean_payment_reference,
      clean_evidence_path
    );
  elsif clean_payment_method = 'cash' and coalesce(p_confirmed_received, false) then
    perform public.record_project_ilaw_cash_payment(created.id, created.total_amount, p_confirmed_received, null);
  end if;

  -- Refresh the row so the response reports the status after any payment work.
  select * into created
  from public.project_ilaw_orders
  where id = created.id;

  return jsonb_build_object(
    'order_id', created.id,
    'reference', created.reference,
    'payment_token', created.payment_token,
    'total_quantity', created.total_quantity,
    'total_amount', created.total_amount,
    'payment_status', created.payment_status,
    'fulfillment_status', created.fulfillment_status,
    'created_at', created.created_at,
    'source', 'staff'
  );
end;
$$;

revoke all on function public.create_project_ilaw_staff_order(
  uuid, text, text, text, jsonb, text, text, text, boolean
) from public, anon, authenticated;

grant execute on function public.create_project_ilaw_staff_order(
  uuid, text, text, text, jsonb, text, text, text, boolean
) to authenticated;
