-- Project Ilaw Phase 2 (follow-up): cash payment recording.
-- Extends the existing payment model with a cash confirmation path. GCash
-- evidence requirements are unchanged. Adds payment_method and
-- payment_amount_received columns and a secure cash-recording RPC.

begin;

alter table public.project_ilaw_orders
  add column if not exists payment_method text;

alter table public.project_ilaw_orders
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

-- Keep the GCash path recording its method and amount.
create or replace function public.confirm_project_ilaw_payment(
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

  if target.payment_status <> 'payment_verification' then
    raise exception 'Only a payment awaiting verification can be confirmed' using errcode = 'P0001';
  end if;
  if target.payment_evidence_path is null
     or btrim(target.payment_evidence_path) = '' then
    raise exception 'Payment evidence is required before confirming' using errcode = 'P0001';
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
    order_id, event_type, actor_id, actor_type,
    previous_value, new_value, note
  ) values (
    target.id, 'payment_confirmed', actor, 'user',
    jsonb_build_object('payment_status', previous_status),
    jsonb_build_object(
      'payment_status', 'paid',
      'payment_method', 'gcash',
      'payment_amount_received', target.total_amount,
      'payment_confirmed_at', target.payment_confirmed_at,
      'payment_confirmed_by', actor
    ),
    clean_note
  );

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

revoke all on function public.confirm_project_ilaw_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_project_ilaw_payment(uuid, text) to authenticated;

-- Cash payment recording: no evidence required, but staff must explicitly
-- confirm physical receipt of cash and the amount must match the total.
create or replace function public.record_project_ilaw_cash_payment(
  p_order_id uuid,
  p_amount integer,
  p_confirmed_received boolean default false,
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
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter the amount received' using errcode = '22023';
  end if;
  if not coalesce(p_confirmed_received, false) then
    raise exception 'Confirm that the cash was physically received' using errcode = '22023';
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
  if target.payment_status not in ('awaiting_payment', 'payment_verification') then
    raise exception 'This order cannot accept a cash payment' using errcode = 'P0001';
  end if;
  if p_amount <> target.total_amount then
    raise exception 'The amount received must match the order total' using errcode = '22023';
  end if;

  previous_status := target.payment_status;

  update public.project_ilaw_orders
  set payment_status = 'paid',
      payment_confirmed_at = now(),
      payment_confirmed_by = actor,
      payment_method = 'cash',
      payment_amount_received = p_amount,
      payment_note = clean_note,
      updated_at = now()
  where id = target.id
  returning * into target;

  insert into public.project_ilaw_order_events (
    order_id, event_type, actor_id, actor_type,
    previous_value, new_value, note
  ) values (
    target.id, 'payment_confirmed', actor, 'user',
    jsonb_build_object('payment_status', previous_status),
    jsonb_build_object(
      'payment_status', 'paid',
      'payment_method', 'cash',
      'payment_amount_received', p_amount,
      'payment_confirmed_at', target.payment_confirmed_at,
      'payment_confirmed_by', actor
    ),
    coalesce(clean_note, 'Cash payment recorded')
  );

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

revoke all on function public.record_project_ilaw_cash_payment(uuid, integer, boolean, text) from public, anon, authenticated;
grant execute on function public.record_project_ilaw_cash_payment(uuid, integer, boolean, text) to authenticated;

commit;
