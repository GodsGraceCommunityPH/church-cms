-- Staff-initiated manual confirmation for GCash orders that were verified in the
-- church account outside the customer evidence-upload flow. No fake evidence or
-- transaction reference is recorded; the note is optional and staff identity is
-- captured by the existing payment_confirmed audit event.
create or replace function public.manual_confirm_project_ilaw_gcash_payment(
  p_order_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.project_ilaw_orders%rowtype;
  actor uuid := auth.uid();
  clean_note text := nullif(btrim(coalesce(p_note, '')), '');
  previous_status text;
begin
  if not public.has_permission('project_ilaw.orders.confirm_payment') then
    raise exception 'project_ilaw.orders.confirm_payment permission required' using errcode = '42501';
  end if;
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_order_id is null then
    raise exception 'Order is required' using errcode = '22023';
  end if;
  if clean_note is not null and char_length(clean_note) > 1000 then
    raise exception 'Payment note must be at most 1000 characters' using errcode = '22023';
  end if;

  select * into target
  from public.project_ilaw_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if target.payment_status = 'paid' then
    raise exception 'Payment is already confirmed' using errcode = 'P0001';
  end if;
  if target.fulfillment_status = 'cancelled' then
    raise exception 'A cancelled order cannot be confirmed as paid' using errcode = 'P0001';
  end if;
  if coalesce(target.payment_method, 'gcash') <> 'gcash' then
    raise exception 'Only GCash orders can be manually confirmed this way' using errcode = 'P0001';
  end if;
  if target.payment_status <> 'awaiting_payment' then
    raise exception 'Only orders awaiting payment can be manually confirmed by staff' using errcode = 'P0001';
  end if;

  previous_status := target.payment_status;

  update public.project_ilaw_orders
  set payment_status = 'paid',
      payment_confirmed_at = now(),
      payment_confirmed_by = actor,
      payment_method = 'gcash',
      payment_amount_received = target.total_amount,
      payment_note = clean_note,
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
    'payment_confirmed',
    actor,
    'user',
    jsonb_build_object('payment_status', previous_status),
    jsonb_build_object(
      'payment_status', 'paid',
      'payment_method', 'gcash',
      'payment_amount_received', target.payment_amount_received,
      'payment_confirmed_by', actor
    ),
    coalesce(clean_note, 'Manually confirmed by staff after verifying GCash in the church account.')
  );

  perform public.project_ilaw_sync_production_for_order(target.id);

  return jsonb_build_object(
    'order_id', target.id,
    'reference', target.reference,
    'payment_status', target.payment_status,
    'payment_method', target.payment_method,
    'payment_amount_received', target.payment_amount_received,
    'payment_confirmed_at', target.payment_confirmed_at,
    'payment_confirmed_by', target.payment_confirmed_by,
    'payment_note', target.payment_note
  );
end;
$$;

revoke all on function public.manual_confirm_project_ilaw_gcash_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.manual_confirm_project_ilaw_gcash_payment(uuid, text) to authenticated;
