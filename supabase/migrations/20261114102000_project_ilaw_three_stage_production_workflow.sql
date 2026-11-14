-- Consolidate Pending and Processing into one Processing stage.
update public.project_ilaw_production_progress
set processing_qty = processing_qty + pending_qty, pending_qty = 0, updated_at = now()
where pending_qty <> 0;
update public.project_ilaw_production_movements
set from_stage = case when from_stage = 'pending' then 'processing' else from_stage end,
    to_stage = case when to_stage = 'pending' then 'processing' else to_stage end
where from_stage = 'pending' or to_stage = 'pending';

create or replace function public.project_ilaw_stage_index(p_stage text)
returns integer language sql immutable set search_path to ''
as $function$
  select case p_stage when 'processing' then 0 when 'manufacturing' then 1 when 'completed' then 2 else null end;
$function$;

create or replace function public.get_project_ilaw_production_overview()
returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
begin
  if not public.has_permission('project_ilaw.production.view') then
    raise exception 'project_ilaw.production.view permission required' using errcode = '42501';
  end if;
  return (select jsonb_build_object(
    'total_required', coalesce(sum(required_qty), 0),
    'processing', coalesce(sum(pending_qty + processing_qty), 0),
    'manufacturing', coalesce(sum(manufacturing_qty), 0),
    'completed', coalesce(sum(completed_qty), 0))
    from public.project_ilaw_production_progress);
end;
$function$;

create or replace function public.get_project_ilaw_production_queue()
returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
begin
  if not public.has_permission('project_ilaw.production.view') then
    raise exception 'project_ilaw.production.view permission required' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'variant_id', v.id, 'product_type', v.product_type, 'size', v.size, 'color', v.color,
    'required_qty', p.required_qty, 'processing_qty', p.pending_qty + p.processing_qty,
    'manufacturing_qty', p.manufacturing_qty, 'completed_qty', p.completed_qty)
    order by v.product_type, v.size, v.color)
    from public.project_ilaw_production_variants v
    join public.project_ilaw_production_progress p on p.variant_id = v.id
    where p.required_qty > 0), '[]'::jsonb);
end;
$function$;

create or replace function public.get_project_ilaw_production_variants()
returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
begin
  if not public.has_permission('project_ilaw.production.view') then
    raise exception 'project_ilaw.production.view permission required' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'variant_id', v.id, 'product_type', v.product_type, 'size', v.size, 'color', v.color,
    'required_qty', coalesce(p.required_qty, 0),
    'processing_qty', coalesce(p.pending_qty, 0) + coalesce(p.processing_qty, 0),
    'manufacturing_qty', coalesce(p.manufacturing_qty, 0),
    'completed_qty', coalesce(p.completed_qty, 0), 'updated_at', p.updated_at)
    order by v.product_type, v.size, v.color)
    from public.project_ilaw_production_variants v
    left join public.project_ilaw_production_progress p on p.variant_id = v.id), '[]'::jsonb);
end;
$function$;

create or replace function public.project_ilaw_sync_production_for_order(p_order_id uuid)
returns void language plpgsql security definer set search_path to ''
as $function$
declare item record; v_variant_id uuid;
begin
  if p_order_id is null then return; end if;
  if (select production_synced from public.project_ilaw_orders where id = p_order_id) then return; end if;
  for item in select product_id, size, color, quantity from public.project_ilaw_order_items where order_id = p_order_id loop
    select id into v_variant_id from public.project_ilaw_production_variants
    where product_type = case item.product_id when 'project-ilaw-t-shirt' then 't_shirt' when 'project-ilaw-eco-bag' then 'eco_bag' end
      and size = case when item.product_id = 'project-ilaw-eco-bag' then 'One Size' else item.size end
      and color = item.color;
    if v_variant_id is null then continue; end if;
    insert into public.project_ilaw_production_progress (variant_id, required_qty, processing_qty)
    values (v_variant_id, item.quantity, item.quantity)
    on conflict (variant_id) do update
      set required_qty = public.project_ilaw_production_progress.required_qty + item.quantity,
          processing_qty = public.project_ilaw_production_progress.processing_qty + item.quantity,
          updated_at = now();
    insert into public.project_ilaw_production_movements
      (variant_id, quantity, from_stage, to_stage, movement_type, order_id, note)
    values (v_variant_id, item.quantity, 'none', 'processing', 'auto_add', p_order_id, 'Added from paid order');
  end loop;
  update public.project_ilaw_orders set production_synced = true, production_synced_at = now(), updated_at = now()
  where id = p_order_id;
end;
$function$;

create or replace function public.adjust_project_ilaw_production(p_variant_id uuid, p_quantity_delta integer, p_reason text)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare actor uuid := auth.uid(); clean_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  is_add boolean; qty integer; available_processing integer;
begin
  if not public.has_permission('project_ilaw.production.manage') then raise exception 'project_ilaw.production.manage permission required' using errcode = '42501'; end if;
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_variant_id is null then raise exception 'Variant is required' using errcode = '22023'; end if;
  if p_quantity_delta is null or p_quantity_delta = 0 then raise exception 'Quantity must be non-zero' using errcode = '22023'; end if;
  if clean_reason is null then raise exception 'A reason is required for manual adjustments' using errcode = '22023'; end if;
  if char_length(clean_reason) > 500 then raise exception 'Reason must be at most 500 characters' using errcode = '22023'; end if;
  is_add := p_quantity_delta > 0; qty := abs(p_quantity_delta);
  select pending_qty + processing_qty into available_processing from public.project_ilaw_production_progress where variant_id = p_variant_id for update;
  if available_processing is null then raise exception 'Variant not found' using errcode = 'P0002'; end if;
  if is_add then
    update public.project_ilaw_production_progress set required_qty = required_qty + qty, processing_qty = processing_qty + qty, updated_at = now() where variant_id = p_variant_id;
  else
    if available_processing < qty then raise exception 'Cannot remove more units than are in Processing' using errcode = 'P0001'; end if;
    update public.project_ilaw_production_progress set required_qty = required_qty - qty, processing_qty = processing_qty - qty, updated_at = now() where variant_id = p_variant_id;
  end if;
  insert into public.project_ilaw_production_movements (variant_id, quantity, from_stage, to_stage, movement_type, actor_id, note)
  values (p_variant_id, qty, case when is_add then 'none' else 'processing' end, case when is_add then 'processing' else 'none' end,
    case when is_add then 'manual_add' else 'manual_remove' end, actor, clean_reason);
  return jsonb_build_object('variant_id', p_variant_id, 'delta', p_quantity_delta);
end;
$function$;

create or replace function public.move_project_ilaw_production(p_variant_id uuid, p_quantity integer, p_from text, p_to text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare actor uuid := auth.uid(); clean_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  from_idx integer; to_idx integer; avail integer; is_backward boolean;
begin
  if not public.has_permission('project_ilaw.production.move') then raise exception 'project_ilaw.production.move permission required' using errcode = '42501'; end if;
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_variant_id is null then raise exception 'Variant is required' using errcode = '22023'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Quantity must be positive' using errcode = '22023'; end if;
  from_idx := public.project_ilaw_stage_index(p_from); to_idx := public.project_ilaw_stage_index(p_to);
  if from_idx is null or to_idx is null then raise exception 'Invalid stage' using errcode = '22023'; end if;
  if abs(from_idx - to_idx) <> 1 then raise exception 'Only adjacent stage movements are allowed' using errcode = '22023'; end if;
  is_backward := to_idx < from_idx;
  if is_backward and clean_reason is null then raise exception 'A reason is required for backward movements' using errcode = '22023'; end if;
  if clean_reason is not null and char_length(clean_reason) > 500 then raise exception 'Reason must be at most 500 characters' using errcode = '22023'; end if;
  select case p_from when 'processing' then pending_qty + processing_qty when 'manufacturing' then manufacturing_qty when 'completed' then completed_qty end
  into avail from public.project_ilaw_production_progress where variant_id = p_variant_id for update;
  if avail is null then raise exception 'Variant not found' using errcode = 'P0002'; end if;
  if avail < p_quantity then raise exception 'Not enough units in the source stage' using errcode = 'P0001'; end if;
  update public.project_ilaw_production_progress
  set processing_qty = processing_qty - case when p_from = 'processing' then p_quantity else 0 end + case when p_to = 'processing' then p_quantity else 0 end,
      manufacturing_qty = manufacturing_qty - case when p_from = 'manufacturing' then p_quantity else 0 end + case when p_to = 'manufacturing' then p_quantity else 0 end,
      completed_qty = completed_qty - case when p_from = 'completed' then p_quantity else 0 end + case when p_to = 'completed' then p_quantity else 0 end,
      updated_at = now() where variant_id = p_variant_id;
  insert into public.project_ilaw_production_movements (variant_id, quantity, from_stage, to_stage, movement_type, actor_id, note)
  values (p_variant_id, p_quantity, p_from, p_to, case when is_backward then 'backward' else 'forward' end, actor, clean_reason);
  return jsonb_build_object('variant_id', p_variant_id, 'quantity', p_quantity, 'from', p_from, 'to', p_to);
end;
$function$;

create or replace function public.resolve_project_ilaw_production_review(p_flag_id uuid, p_quantity integer, p_note text default null)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare actor uuid := auth.uid(); flag record; progress record; clean_note text := nullif(btrim(coalesce(p_note, '')), '');
  remaining integer; take_completed integer; take_manufacturing integer; take_processing integer;
begin
  if not public.has_permission('project_ilaw.production.manage') then raise exception 'project_ilaw.production.manage permission required' using errcode = '42501'; end if;
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_flag_id is null then raise exception 'Flag is required' using errcode = '22023'; end if;
  select * into flag from public.project_ilaw_production_review_flags where id = p_flag_id for update;
  if not found then raise exception 'Review flag not found' using errcode = 'P0002'; end if;
  if flag.status <> 'pending' then raise exception 'This review flag is already resolved' using errcode = 'P0001'; end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > flag.quantity then raise exception 'Invalid adjustment quantity' using errcode = '22023'; end if;
  select * into progress from public.project_ilaw_production_progress where variant_id = flag.variant_id for update;
  if not found then raise exception 'Production progress not found' using errcode = 'P0002'; end if;
  if progress.completed_qty + progress.manufacturing_qty + progress.processing_qty + progress.pending_qty < p_quantity then raise exception 'Review quantity exceeds remaining production quantity' using errcode = 'P0001'; end if;
  remaining := p_quantity; take_completed := least(progress.completed_qty, remaining); remaining := remaining - take_completed;
  take_manufacturing := least(progress.manufacturing_qty, remaining); remaining := remaining - take_manufacturing; take_processing := remaining;
  update public.project_ilaw_production_progress set required_qty = required_qty - p_quantity,
    completed_qty = completed_qty - take_completed, manufacturing_qty = manufacturing_qty - take_manufacturing,
    processing_qty = processing_qty - take_processing, updated_at = now() where variant_id = flag.variant_id;
  update public.project_ilaw_production_review_flags set status = 'resolved', resolved_by = actor, resolved_at = now(), resolution_note = clean_note where id = p_flag_id;
  insert into public.project_ilaw_production_movements (variant_id, quantity, from_stage, to_stage, movement_type, actor_id, note, order_id)
  values (flag.variant_id, p_quantity, case when take_completed > 0 then 'completed' when take_manufacturing > 0 then 'manufacturing' else 'processing' end,
    'none', 'review_adjustment', actor, clean_note, flag.order_id);
  return jsonb_build_object('flag_id', p_flag_id, 'quantity', p_quantity, 'status', 'resolved');
end;
$function$;

create or replace function public.update_project_ilaw_fulfillment(p_order_id uuid, p_status text, p_note text default null)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare target public.project_ilaw_orders%rowtype; actor uuid := auth.uid(); clean_status text := btrim(coalesce(p_status, ''));
  clean_note text := nullif(btrim(coalesce(p_note, '')), ''); previous_status text; item record; v_variant_id uuid;
  avail_processing integer; shortfall integer;
begin
  if not public.has_permission('project_ilaw.orders.fulfill') then raise exception 'project_ilaw.orders.fulfill permission required' using errcode = '42501'; end if;
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_order_id is null then raise exception 'Order is required' using errcode = '22023'; end if;
  if clean_status not in ('in_production', 'ready_for_pickup', 'completed', 'cancelled') then raise exception 'Invalid fulfillment status' using errcode = '22023'; end if;
  if clean_note is not null and char_length(clean_note) > 1000 then raise exception 'Status note must be at most 1000 characters' using errcode = '22023'; end if;
  select * into target from public.project_ilaw_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if target.fulfillment_status = clean_status then raise exception 'Order already has that fulfillment status' using errcode = 'P0001'; end if;
  previous_status := target.fulfillment_status;
  if clean_status = 'cancelled' then
    if previous_status not in ('not_started', 'in_production', 'ready_for_pickup') then raise exception 'This order cannot be cancelled from its current status' using errcode = 'P0001'; end if;
    update public.project_ilaw_orders set fulfillment_status = 'cancelled', cancelled_at = now(), cancelled_by = actor,
      cancel_reason = clean_note, updated_at = now() where id = target.id returning * into target;
    insert into public.project_ilaw_order_events (order_id, event_type, actor_id, actor_type, previous_value, new_value, note)
    values (target.id, 'order_cancelled', actor, 'user', jsonb_build_object('fulfillment_status', previous_status),
      jsonb_build_object('fulfillment_status', 'cancelled', 'cancelled_at', target.cancelled_at, 'cancelled_by', actor), clean_note);
    if (select production_synced from public.project_ilaw_orders where id = target.id) then
      for item in select product_id, size, color, quantity from public.project_ilaw_order_items where order_id = target.id loop
        select id into v_variant_id from public.project_ilaw_production_variants
        where product_type = case item.product_id when 'project-ilaw-t-shirt' then 't_shirt' when 'project-ilaw-eco-bag' then 'eco_bag' end
          and size = case when item.product_id = 'project-ilaw-eco-bag' then 'One Size' else item.size end and color = item.color;
        if v_variant_id is null then continue; end if;
        select pending_qty + processing_qty into avail_processing from public.project_ilaw_production_progress
        where variant_id = v_variant_id for update;
        if avail_processing >= item.quantity then
          update public.project_ilaw_production_progress set required_qty = required_qty - item.quantity,
            processing_qty = processing_qty - item.quantity, updated_at = now() where variant_id = v_variant_id;
          insert into public.project_ilaw_production_movements (variant_id, quantity, from_stage, to_stage, movement_type, order_id, note)
          values (v_variant_id, item.quantity, 'processing', 'none', 'auto_deduct', target.id, 'Deducted from cancelled order');
        else
          shortfall := item.quantity - coalesce(avail_processing, 0);
          if coalesce(avail_processing, 0) > 0 then
            update public.project_ilaw_production_progress set required_qty = required_qty - avail_processing,
              processing_qty = processing_qty - avail_processing, updated_at = now() where variant_id = v_variant_id;
            insert into public.project_ilaw_production_movements (variant_id, quantity, from_stage, to_stage, movement_type, order_id, note)
            values (v_variant_id, avail_processing, 'processing', 'none', 'auto_deduct', target.id, 'Partial deduct from cancelled order');
          end if;
          insert into public.project_ilaw_production_review_flags (variant_id, order_id, quantity) values (v_variant_id, target.id, shortfall);
        end if;
      end loop;
    end if;
  else
    if not ((previous_status = 'not_started' and clean_status in ('in_production', 'ready_for_pickup'))
      or (previous_status = 'in_production' and clean_status = 'ready_for_pickup')
      or (previous_status = 'ready_for_pickup' and clean_status = 'completed')) then
      raise exception 'Invalid fulfillment status transition' using errcode = 'P0001';
    end if;
    update public.project_ilaw_orders set fulfillment_status = clean_status, updated_at = now()
    where id = target.id returning * into target;
    insert into public.project_ilaw_order_events (order_id, event_type, actor_id, actor_type, previous_value, new_value, note)
    values (target.id, 'fulfillment_changed', actor, 'user', jsonb_build_object('fulfillment_status', previous_status),
      jsonb_build_object('fulfillment_status', clean_status), clean_note);
  end if;
  return jsonb_build_object('order_id', target.id, 'reference', target.reference,
    'fulfillment_status', target.fulfillment_status, 'payment_status', target.payment_status);
end;
$function$;
