-- Allow authorised Project Ilaw payment staff to correct payment method and
-- amount due, including after payment has been confirmed. Preserve line-item
-- prices, payment evidence, and the actual amount received as separate facts.

begin;

alter table public.project_ilaw_orders
  add column if not exists total_amount_adjustment integer not null default 0;

alter table public.project_ilaw_order_events
  drop constraint if exists project_ilaw_order_events_type_check;

alter table public.project_ilaw_order_events
  add constraint project_ilaw_order_events_type_check
  check (
    event_type in (
      'order_created',
      'payment_submitted',
      'payment_confirmed',
      'payment_rejected',
      'payment_method_changed',
      'payment_details_changed',
      'fulfillment_changed',
      'order_amended',
      'order_cancelled'
    )
  );

-- The order total may differ from the sum of line items only by the explicitly
-- recorded adjustment. Unit prices and line totals remain the catalogue values.
create or replace function public.verify_project_ilaw_order_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_order_id uuid;
  active_quantity integer;
  active_amount integer;
begin
  if tg_op = 'DELETE' then
    target_order_id := old.order_id;
  else
    target_order_id := new.order_id;
  end if;

  if not exists (
    select 1 from public.project_ilaw_orders where id = target_order_id
  ) then
    return null;
  end if;

  select coalesce(sum(quantity), 0), coalesce(sum(line_total), 0)
  into active_quantity, active_amount
  from public.project_ilaw_order_items
  where order_id = target_order_id and superseded_at is null;

  if exists (
    select 1
    from public.project_ilaw_orders
    where id = target_order_id
      and (
        total_quantity <> active_quantity
        or total_amount <> active_amount + total_amount_adjustment
      )
  ) then
    raise exception 'Project Ilaw order totals do not match its active line items and payment adjustment'
      using errcode = '23514';
  end if;

  return null;
end;
$function$;

create or replace function public.project_ilaw_order_snapshot(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'customer_name', orders.customer_name,
    'mobile', orders.mobile,
    'notes', orders.notes,
    'total_quantity', orders.total_quantity,
    'total_amount', orders.total_amount,
    'total_amount_adjustment', orders.total_amount_adjustment,
    'payment_status', orders.payment_status,
    'fulfillment_status', orders.fulfillment_status,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', items.product_id,
        'product_name', items.product_name,
        'product_type', items.product_type,
        'size', items.size,
        'color', items.color,
        'quantity', items.quantity,
        'unit_price', items.unit_price,
        'line_total', items.line_total
      ) order by items.line_number)
      from public.project_ilaw_order_items items
      where items.order_id = orders.id and items.superseded_at is null
    ), '[]'::jsonb)
  )
  from public.project_ilaw_orders orders
  where orders.id = p_order_id;
$function$;

-- Keep an existing manual price adjustment when an authorised user later
-- amends product quantities or variants. Reject a revision that would make
-- the adjusted amount due zero or negative.
do $$
declare
  function_definition text;
  old_anchor text := '  snapshot_items := validated -> ''items'';';
  new_anchor text := old_anchor || E'\n\n  if (validated ->> ''total_amount'')::integer + target.total_amount_adjustment <= 0 then\n    raise exception ''The existing price adjustment would make the revised amount due invalid'' using errcode = ''22023'';\n  end if;';
  old_total text := '      total_amount = (validated ->> ''total_amount'')::integer,';
  new_total text := '      total_amount = (validated ->> ''total_amount'')::integer + target.total_amount_adjustment,';
begin
  function_definition := pg_get_functiondef(
    'public.amend_project_ilaw_order(uuid,text,text,text,jsonb,text)'::regprocedure
  );

  if position(old_anchor in function_definition) = 0
     or position(old_total in function_definition) = 0 then
    raise exception 'Expected Project Ilaw amendment logic was not found; refusing to rewrite function';
  end if;

  function_definition := replace(function_definition, old_anchor, new_anchor);
  function_definition := replace(function_definition, old_total, new_total);
  execute function_definition;
end
$$;

create or replace function public.update_project_ilaw_payment_details(
  p_order_id uuid,
  p_payment_method text,
  p_total_amount integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target public.project_ilaw_orders%rowtype;
  actor uuid := auth.uid();
  clean_payment_method text := nullif(lower(btrim(coalesce(p_payment_method, ''))), '');
  active_subtotal integer;
  next_adjustment integer;
  method_changed boolean;
  clear_previous_submission boolean;
  previous_value jsonb;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (
    public.has_permission('project_ilaw.orders.confirm_payment')
    or public.has_permission('project_ilaw.orders.manage')
  ) then
    raise exception 'Project Ilaw payment permission required' using errcode = '42501';
  end if;

  if p_order_id is null then
    raise exception 'Order is required' using errcode = '22023';
  end if;

  if clean_payment_method is not null
     and clean_payment_method not in ('gcash', 'cash') then
    raise exception 'Choose GCash or Cash as the payment method' using errcode = '22023';
  end if;

  if p_total_amount is null or p_total_amount < 1 or p_total_amount > 9999999 then
    raise exception 'Amount due must be a whole number from 1 to 9,999,999' using errcode = '22023';
  end if;

  select *
  into target
  from public.project_ilaw_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if target.fulfillment_status = 'cancelled' then
    raise exception 'Payment details cannot be changed for a cancelled order' using errcode = 'P0001';
  end if;

  if target.payment_status not in ('awaiting_payment', 'paid') then
    raise exception 'Payment details cannot be changed while a payment is awaiting verification' using errcode = 'P0001';
  end if;

  if target.payment_status = 'awaiting_payment'
     and target.fulfillment_status <> 'not_started' then
    raise exception 'Payment details cannot be changed after fulfillment has started' using errcode = 'P0001';
  end if;

  if clean_payment_method = 'gcash' then
    if regexp_replace(coalesce(target.mobile, ''), '[^0-9]', '', 'g') !~ '^[0-9]{10,15}$' then
      raise exception 'A valid customer mobile number is required for GCash' using errcode = '22023';
    end if;
  end if;

  select coalesce(sum(line_total), 0)::integer
  into active_subtotal
  from public.project_ilaw_order_items
  where order_id = target.id and superseded_at is null;

  next_adjustment := p_total_amount - active_subtotal;
  method_changed := target.payment_method is distinct from clean_payment_method;

  if not method_changed
     and target.total_amount = p_total_amount then
    raise exception 'Payment details are unchanged' using errcode = 'P0001';
  end if;

  clear_previous_submission :=
    target.payment_status = 'awaiting_payment'
    and method_changed
    and (
      target.payment_reference is not null
      or target.payment_evidence_path is not null
      or target.payment_rejected_at is not null
    );

  previous_value := jsonb_build_object(
    'payment_status', target.payment_status,
    'payment_method', target.payment_method,
    'total_amount', target.total_amount,
    'total_amount_adjustment', target.total_amount_adjustment,
    'payment_amount_received', target.payment_amount_received,
    'payment_reference', target.payment_reference,
    'payment_evidence_path', target.payment_evidence_path,
    'payment_submitted_at', target.payment_submitted_at,
    'payment_rejected_at', target.payment_rejected_at,
    'payment_rejection_reason', target.payment_rejection_reason
  );

  update public.project_ilaw_orders
  set payment_method = clean_payment_method,
      total_amount = p_total_amount,
      total_amount_adjustment = next_adjustment,
      payment_reference = case when clear_previous_submission then null else payment_reference end,
      payment_evidence_path = case when clear_previous_submission then null else payment_evidence_path end,
      payment_submitted_at = case when clear_previous_submission then null else payment_submitted_at end,
      payment_rejected_at = case when clear_previous_submission then null else payment_rejected_at end,
      payment_rejection_reason = case when clear_previous_submission then null else payment_rejection_reason end,
      payment_amount_received = case
        when target.payment_status = 'paid'
          then coalesce(payment_amount_received, target.total_amount)
        else payment_amount_received
      end,
      updated_at = now()
  where id = target.id
  returning * into target;

  insert into public.project_ilaw_order_events (
    order_id,
    event_type,
    actor_id,
    actor_type,
    previous_value,
    new_value,
    note
  ) values (
    target.id,
    'payment_details_changed',
    actor,
    'user',
    previous_value,
    jsonb_build_object(
      'payment_status', target.payment_status,
      'payment_method', target.payment_method,
      'total_amount', target.total_amount,
      'total_amount_adjustment', target.total_amount_adjustment,
      'payment_amount_received', target.payment_amount_received,
      'payment_reference', target.payment_reference,
      'payment_evidence_path', target.payment_evidence_path
    ),
    case
      when target.payment_status = 'paid'
        then 'Payment details corrected by authorised staff. The recorded amount received and payment evidence were preserved.'
      when clear_previous_submission
        then 'Payment method and/or amount due changed by authorised staff. Superseded payment submission details remain in the activity history.'
      else 'Payment method and/or amount due changed by authorised staff.'
    end
  );

  return jsonb_build_object(
    'order_id', target.id,
    'reference', target.reference,
    'payment_status', target.payment_status,
    'payment_method', target.payment_method,
    'total_amount', target.total_amount,
    'total_amount_adjustment', target.total_amount_adjustment,
    'payment_amount_received', target.payment_amount_received
  );
end;
$function$;

revoke all on function public.update_project_ilaw_payment_details(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.update_project_ilaw_payment_details(uuid, text, integer)
  to authenticated;

-- Include the amount due, its line-item adjustment, and actual amount received
-- in each accounting export row. The amount received is deliberately distinct
-- from the corrected amount due for an already-paid order.
create or replace function public.project_ilaw_export_rows(
  p_from date default null::date,
  p_to date default null::date,
  p_product text default null::text,
  p_payment_status text default null::text,
  p_fulfillment_status text default null::text
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not public.has_permission('project_ilaw.orders.export') then
    raise exception 'project_ilaw.orders.export permission required' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'order_reference', orders.reference,
      'order_created_at', orders.created_at,
      'customer_name', orders.customer_name,
      'mobile', orders.mobile,
      'product_name', items.product_name,
      'product_type', items.product_type,
      'size', items.size,
      'color', items.color,
      'quantity', items.quantity,
      'unit_price', items.unit_price,
      'line_total', items.line_total,
      'payment_status', orders.payment_status,
      'payment_method', orders.payment_method,
      'order_total_amount', orders.total_amount,
      'total_amount_adjustment', orders.total_amount_adjustment,
      'payment_amount_received', orders.payment_amount_received,
      'payment_reference', orders.payment_reference,
      'payment_submitted_at', orders.payment_submitted_at,
      'fulfillment_status', orders.fulfillment_status,
      'payment_confirmed_at', orders.payment_confirmed_at,
      'payment_confirmed_by', confirmer.display_name
    ) order by orders.created_at desc, items.line_number), '[]'::jsonb)
    from public.project_ilaw_orders orders
    join public.project_ilaw_order_items items
      on items.order_id = orders.id and items.superseded_at is null
    left join public.users confirmer on confirmer.id = orders.payment_confirmed_by
    where (p_from is null or (orders.created_at at time zone 'Asia/Manila')::date >= p_from)
      and (p_to is null or (orders.created_at at time zone 'Asia/Manila')::date <= p_to)
      and (p_payment_status is null or orders.payment_status = p_payment_status)
      and (p_fulfillment_status is null or orders.fulfillment_status = p_fulfillment_status)
      and (
        p_product is null
        or exists (
          select 1
          from public.project_ilaw_order_items filter_items
          where filter_items.order_id = orders.id
            and filter_items.superseded_at is null
            and filter_items.product_id = p_product
        )
      )
  );
end;
$function$;

commit;
