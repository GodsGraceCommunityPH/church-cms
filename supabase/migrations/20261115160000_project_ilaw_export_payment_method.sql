-- Expose the payment method to the staff CSV export so the order-list
-- payment-method filter also applies to downloaded rows.
begin;

create or replace function public.project_ilaw_export_rows(
  p_from date default null,
  p_to date default null,
  p_product text default null,
  p_payment_status text default null,
  p_fulfillment_status text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('project_ilaw.orders.export') then
    raise exception 'project_ilaw.orders.export permission required'
      using errcode = '42501';
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
$$;

commit;
