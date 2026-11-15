-- Allow authorised Project Ilaw payment staff to correct the payment method
-- while an order is still awaiting payment. Submitted or confirmed payments
-- cannot be reclassified. Any rejected GCash submission details are detached
-- from the active order fields and remain represented in append-only history.

begin;

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
      'fulfillment_changed',
      'order_amended',
      'order_cancelled'
    )
  );

create or replace function public.update_project_ilaw_payment_method(
  p_order_id uuid,
  p_payment_method text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.project_ilaw_orders%rowtype;
  actor uuid := auth.uid();
  clean_payment_method text := lower(btrim(coalesce(p_payment_method, '')));
  mobile_digits text;
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

  if clean_payment_method not in ('gcash', 'cash') then
    raise exception 'Choose GCash or Cash as the payment method' using errcode = '22023';
  end if;

  select *
  into target
  from public.project_ilaw_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if target.payment_status <> 'awaiting_payment' then
    raise exception 'Payment method can only be changed while payment is awaiting' using errcode = 'P0001';
  end if;

  if target.fulfillment_status <> 'not_started' then
    raise exception 'Payment method cannot be changed after fulfillment has started' using errcode = 'P0001';
  end if;

  if target.payment_method is not distinct from clean_payment_method then
    raise exception 'This order already uses that payment method' using errcode = 'P0001';
  end if;

  if clean_payment_method = 'gcash' then
    mobile_digits := regexp_replace(coalesce(target.mobile, ''), '[^0-9]', '', 'g');
    if char_length(mobile_digits) < 10 or char_length(mobile_digits) > 15 then
      raise exception 'A valid customer mobile number is required for GCash' using errcode = '22023';
    end if;
  end if;

  previous_value := jsonb_build_object(
    'payment_method', target.payment_method,
    'payment_status', target.payment_status,
    'payment_reference', target.payment_reference,
    'payment_evidence_path', target.payment_evidence_path,
    'payment_submitted_at', target.payment_submitted_at,
    'payment_rejected_at', target.payment_rejected_at,
    'payment_rejection_reason', target.payment_rejection_reason
  );

  update public.project_ilaw_orders
  set payment_method = clean_payment_method,
      payment_reference = null,
      payment_evidence_path = null,
      payment_submitted_at = null,
      payment_rejected_at = null,
      payment_rejection_reason = null,
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
    'payment_method_changed',
    actor,
    'user',
    previous_value,
    jsonb_build_object(
      'payment_method', target.payment_method,
      'payment_status', target.payment_status
    ),
    'Payment method changed by authorised staff. Any previous rejected payment details were cleared from the active order fields.'
  );

  return jsonb_build_object(
    'order_id', target.id,
    'reference', target.reference,
    'payment_status', target.payment_status,
    'payment_method', target.payment_method
  );
end;
$$;

revoke all on function public.update_project_ilaw_payment_method(uuid, text)
  from public, anon, authenticated;
grant execute on function public.update_project_ilaw_payment_method(uuid, text)
  to authenticated;

commit;
