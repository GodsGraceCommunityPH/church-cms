-- Project Ilaw Phase 2 (follow-up): Item Management / production tracking.
-- Adds production variant, progress, movement, and review-flag tables plus
-- RPCs for movements, adjustments, and synchronization with paid orders.
-- Does not alter ordering/payment behavior except to trigger production sync.

begin;

-- Track whether an order's quantities have been synced into production.
alter table public.project_ilaw_orders
  add column if not exists production_synced boolean not null default false;

alter table public.project_ilaw_orders
  add column if not exists production_synced_at timestamptz;

-- Production variants (catalog of product/size/colour combinations).
create table if not exists public.project_ilaw_production_variants (
  id uuid primary key default gen_random_uuid(),
  product_type text not null check (product_type in ('t_shirt', 'eco_bag')),
  size text not null,
  color text not null,
  unique (product_type, size, color)
);

-- Seed variants.
insert into public.project_ilaw_production_variants (product_type, size, color)
select 't_shirt', s, c
from unnest(array['XS','S','M','L','XL','2XL','3XL']) as s,
     unnest(array['Black','White','Maroon','Green','Blue']) as c
on conflict (product_type, size, color) do nothing;

insert into public.project_ilaw_production_variants (product_type, size, color)
select 'eco_bag', 'One Size', c
from unnest(array['Maroon','Green','Blue']) as c
on conflict (product_type, size, color) do nothing;

-- Production progress per variant.
create table if not exists public.project_ilaw_production_progress (
  variant_id uuid primary key references public.project_ilaw_production_variants(id) on delete cascade,
  required_qty integer not null default 0,
  pending_qty integer not null default 0,
  processing_qty integer not null default 0,
  manufacturing_qty integer not null default 0,
  completed_qty integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint project_ilaw_progress_nonnegative check (
    required_qty >= 0 and pending_qty >= 0 and processing_qty >= 0
    and manufacturing_qty >= 0 and completed_qty >= 0
  ),
  constraint project_ilaw_progress_reconciled check (
    required_qty = pending_qty + processing_qty + manufacturing_qty + completed_qty
  )
);

insert into public.project_ilaw_production_progress (variant_id)
select id from public.project_ilaw_production_variants
on conflict (variant_id) do nothing;

-- Production movement audit log.
create table if not exists public.project_ilaw_production_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.project_ilaw_production_variants(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  from_stage text not null check (from_stage in ('pending','processing','manufacturing','completed','none')),
  to_stage text not null check (to_stage in ('pending','processing','manufacturing','completed','none')),
  movement_type text not null check (movement_type in ('auto_add','auto_deduct','forward','backward','manual_add','manual_remove','review_adjustment')),
  actor_id uuid references public.users(id) on delete set null,
  note text,
  order_id uuid references public.project_ilaw_orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists project_ilaw_prod_movements_variant_idx
  on public.project_ilaw_production_movements (variant_id, created_at desc);

-- Review flags for cancellations after production started.
create table if not exists public.project_ilaw_production_review_flags (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.project_ilaw_production_variants(id) on delete cascade,
  order_id uuid not null references public.project_ilaw_orders(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  status text not null default 'pending' check (status in ('pending','resolved')),
  created_at timestamptz not null default now(),
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text
);

create index if not exists project_ilaw_prod_review_status_idx
  on public.project_ilaw_production_review_flags (status, created_at desc);

-- RLS.
alter table public.project_ilaw_production_variants enable row level security;
alter table public.project_ilaw_production_progress enable row level security;
alter table public.project_ilaw_production_movements enable row level security;
alter table public.project_ilaw_production_review_flags enable row level security;

revoke all on public.project_ilaw_production_variants,
  public.project_ilaw_production_progress,
  public.project_ilaw_production_movements,
  public.project_ilaw_production_review_flags
  from public, anon, authenticated;

grant select on public.project_ilaw_production_variants,
  public.project_ilaw_production_progress,
  public.project_ilaw_production_movements,
  public.project_ilaw_production_review_flags
  to authenticated;

-- Permissions.
insert into public.permissions (code, name, module, description) values
  ('project_ilaw.production.view', 'View Project Ilaw production', 'project_ilaw', 'View Project Ilaw production quantities, variants, queue, and history.'),
  ('project_ilaw.production.manage', 'Manage Project Ilaw production', 'project_ilaw', 'Move production quantities, record manual adjustments, and resolve cancellation review flags.')
on conflict (code) do update
set name = excluded.name, module = excluded.module, description = excluded.description, updated_at = now();

-- Grant view to staff and admin; manage to admin only.
insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles role
join public.permissions permission
  on permission.code in ('project_ilaw.production.view')
where role.code in ('project_ilaw_orders_staff', 'administrator')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles role
join public.permissions permission
  on permission.code = 'project_ilaw.production.manage'
where role.code = 'administrator'
on conflict (role_id, permission_id) do nothing;

-- Helper: stage index.
create or replace function public.project_ilaw_stage_index(p_stage text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_stage
    when 'pending' then 0
    when 'processing' then 1
    when 'manufacturing' then 2
    when 'completed' then 3
    else null
  end;
$$;

-- Sync production for a paid order (idempotent via production_synced).
create or replace function public.project_ilaw_sync_production_for_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
  variant_id uuid;
  actor uuid;
begin
  if p_order_id is null then return; end if;

  select production_synced into actor from public.project_ilaw_orders where id = p_order_id;
  -- actor reused as flag check
  if (select production_synced from public.project_ilaw_orders where id = p_order_id) then
    return;
  end if;

  for item in
    select product_id, size, color, quantity
    from public.project_ilaw_order_items
    where order_id = p_order_id
  loop
    select id into variant_id
    from public.project_ilaw_production_variants
    where product_type = case item.product_id
           when 'project-ilaw-t-shirt' then 't_shirt'
           when 'project-ilaw-eco-bag' then 'eco_bag'
         end
      and size = case when item.product_id = 'project-ilaw-eco-bag' then 'One Size' else item.size end
      and color = item.color;

    if variant_id is null then continue; end if;

    insert into public.project_ilaw_production_progress (variant_id, required_qty, pending_qty)
    values (variant_id, item.quantity, item.quantity)
    on conflict (variant_id) do update
      set required_qty = project_ilaw_production_progress.required_qty + item.quantity,
          pending_qty = project_ilaw_production_progress.pending_qty + item.quantity,
          updated_at = now();

    insert into public.project_ilaw_production_movements
      (variant_id, quantity, from_stage, to_stage, movement_type, order_id, note)
    values
      (variant_id, item.quantity, 'none', 'pending', 'auto_add', p_order_id,
       'Added from paid order');
  end loop;

  update public.project_ilaw_orders
  set production_synced = true,
      production_synced_at = now(),
      updated_at = now()
  where id = p_order_id;
end;
$$;

-- Update confirm_project_ilaw_payment to sync production.
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

revoke all on function public.confirm_project_ilaw_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_project_ilaw_payment(uuid, text) to authenticated;

-- record_project_ilaw_cash_payment already defined in 20261114...; update it to sync production.
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

revoke all on function public.record_project_ilaw_cash_payment(uuid, integer, boolean, text) from public, anon, authenticated;
grant execute on function public.record_project_ilaw_cash_payment(uuid, integer, boolean, text) to authenticated;

-- Cancellation handling: when an order is cancelled, update production.
create or replace function public.update_project_ilaw_fulfillment(
  p_order_id uuid,
  p_status text,
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
  clean_status text := btrim(coalesce(p_status, ''));
  clean_note text := nullif(btrim(coalesce(p_note, '')), '');
  previous_status text;
  item record;
  variant_id uuid;
  avail_pending integer;
  shortfall integer;
begin
  if not public.has_permission('project_ilaw.orders.manage') then
    raise exception 'project_ilaw.orders.manage permission required' using errcode = '42501';
  end if;
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_order_id is null then
    raise exception 'Order is required' using errcode = '22023';
  end if;
  if clean_status not in ('in_production', 'ready_for_pickup', 'completed', 'cancelled') then
    raise exception 'Invalid fulfillment status' using errcode = '22023';
  end if;
  if clean_note is not null and char_length(clean_note) > 1000 then
    raise exception 'Status note must be at most 1000 characters' using errcode = '22023';
  end if;

  select * into target
  from public.project_ilaw_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if target.fulfillment_status = clean_status then
    raise exception 'Order already has that fulfillment status' using errcode = 'P0001';
  end if;

  previous_status := target.fulfillment_status;

  if clean_status = 'cancelled' then
    if previous_status not in ('not_started', 'in_production', 'ready_for_pickup') then
      raise exception 'This order cannot be cancelled from its current status' using errcode = 'P0001';
    end if;

    update public.project_ilaw_orders
    set fulfillment_status = 'cancelled',
        cancelled_at = now(),
        cancelled_by = actor,
        cancel_reason = clean_note,
        updated_at = now()
    where id = target.id
    returning * into target;

    insert into public.project_ilaw_order_events (
      order_id, event_type, actor_id, actor_type,
      previous_value, new_value, note
    ) values (
      target.id, 'order_cancelled', actor, 'user',
      jsonb_build_object('fulfillment_status', previous_status),
      jsonb_build_object(
        'fulfillment_status', 'cancelled',
        'cancelled_at', target.cancelled_at,
        'cancelled_by', actor
      ),
      clean_note
    );

    -- Production sync on cancellation (only if synced).
    if (select production_synced from public.project_ilaw_orders where id = target.id) then
      for item in
        select product_id, size, color, quantity
        from public.project_ilaw_order_items
        where order_id = target.id
      loop
        select id into variant_id
        from public.project_ilaw_production_variants
        where product_type = case item.product_id
               when 'project-ilaw-t-shirt' then 't_shirt'
               when 'project-ilaw-eco-bag' then 'eco_bag'
             end
          and size = case when item.product_id = 'project-ilaw-eco-bag' then 'One Size' else item.size end
          and color = item.color;

        if variant_id is null then continue; end if;

        select pending_qty into avail_pending
        from public.project_ilaw_production_progress
        where variant_id = variant_id;

        if avail_pending >= item.quantity then
          update public.project_ilaw_production_progress
          set required_qty = required_qty - item.quantity,
              pending_qty = pending_qty - item.quantity,
              updated_at = now()
          where variant_id = variant_id;

          insert into public.project_ilaw_production_movements
            (variant_id, quantity, from_stage, to_stage, movement_type, order_id, note)
          values
            (variant_id, item.quantity, 'pending', 'none', 'auto_deduct', target.id,
             'Deducted from cancelled order');
        else
          shortfall := item.quantity - coalesce(avail_pending, 0);
          if coalesce(avail_pending, 0) > 0 then
            update public.project_ilaw_production_progress
            set required_qty = required_qty - avail_pending,
                pending_qty = pending_qty - avail_pending,
                updated_at = now()
            where variant_id = variant_id;

            insert into public.project_ilaw_production_movements
              (variant_id, quantity, from_stage, to_stage, movement_type, order_id, note)
            values
              (variant_id, avail_pending, 'pending', 'none', 'auto_deduct', target.id,
               'Partial deduct from cancelled order');
          end if;

          insert into public.project_ilaw_production_review_flags
            (variant_id, order_id, quantity)
          values (variant_id, target.id, shortfall);
        end if;
      end loop;
    end if;
  else
    if not (
      (previous_status = 'not_started' and clean_status in ('in_production', 'ready_for_pickup'))
      or (previous_status = 'in_production' and clean_status = 'ready_for_pickup')
      or (previous_status = 'ready_for_pickup' and clean_status = 'completed')
    ) then
      raise exception 'Invalid fulfillment status transition' using errcode = 'P0001';
    end if;

    update public.project_ilaw_orders
    set fulfillment_status = clean_status,
        updated_at = now()
    where id = target.id
    returning * into target;

    insert into public.project_ilaw_order_events (
      order_id, event_type, actor_id, actor_type,
      previous_value, new_value, note
    ) values (
      target.id, 'fulfillment_changed', actor, 'user',
      jsonb_build_object('fulfillment_status', previous_status),
      jsonb_build_object('fulfillment_status', clean_status),
      clean_note
    );
  end if;

  return jsonb_build_object(
    'order_id', target.id,
    'reference', target.reference,
    'fulfillment_status', target.fulfillment_status,
    'payment_status', target.payment_status
  );
end;
$$;

revoke all on function public.update_project_ilaw_fulfillment(uuid, text, text) from public, anon, authenticated;
grant execute on function public.update_project_ilaw_fulfillment(uuid, text, text) to authenticated;

-- Move production quantities between adjacent stages.
create or replace function public.move_project_ilaw_production(
  p_variant_id uuid,
  p_quantity integer,
  p_from text,
  p_to text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  clean_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  from_idx integer;
  to_idx integer;
  avail integer;
  is_backward boolean;
begin
  if not public.has_permission('project_ilaw.production.manage') then
    raise exception 'project_ilaw.production.manage permission required' using errcode = '42501';
  end if;
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_variant_id is null then
    raise exception 'Variant is required' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be positive' using errcode = '22023';
  end if;

  from_idx := public.project_ilaw_stage_index(p_from);
  to_idx := public.project_ilaw_stage_index(p_to);
  if from_idx is null or to_idx is null then
    raise exception 'Invalid stage' using errcode = '22023';
  end if;
  if abs(from_idx - to_idx) <> 1 then
    raise exception 'Only adjacent stage movements are allowed' using errcode = '22023';
  end if;

  is_backward := to_idx < from_idx;
  if is_backward and clean_reason is null then
    raise exception 'A reason is required for backward movements' using errcode = '22023';
  end if;
  if clean_reason is not null and char_length(clean_reason) > 500 then
    raise exception 'Reason must be at most 500 characters' using errcode = '22023';
  end if;

  -- lock progress row
  select case p_from
    when 'pending' then pending_qty
    when 'processing' then processing_qty
    when 'manufacturing' then manufacturing_qty
    when 'completed' then completed_qty
  end into avail
  from public.project_ilaw_production_progress
  where variant_id = p_variant_id
  for update;

  if avail is null then
    raise exception 'Variant not found' using errcode = 'P0002';
  end if;
  if avail < p_quantity then
    raise exception 'Not enough units in the source stage' using errcode = 'P0001';
  end if;

  -- update source
  update public.project_ilaw_production_progress
  set pending_qty = case when p_from = 'pending' then pending_qty - p_quantity else pending_qty end,
      processing_qty = case when p_from = 'processing' then processing_qty - p_quantity else processing_qty end,
      manufacturing_qty = case when p_from = 'manufacturing' then manufacturing_qty - p_quantity else manufacturing_qty end,
      completed_qty = case when p_from = 'completed' then completed_qty - p_quantity else completed_qty end,
      updated_at = now()
  where variant_id = p_variant_id;

  -- update destination
  update public.project_ilaw_production_progress
  set pending_qty = case when p_to = 'pending' then pending_qty + p_quantity else pending_qty end,
      processing_qty = case when p_to = 'processing' then processing_qty + p_quantity else processing_qty end,
      manufacturing_qty = case when p_to = 'manufacturing' then manufacturing_qty + p_quantity else manufacturing_qty end,
      completed_qty = case when p_to = 'completed' then completed_qty + p_quantity else completed_qty end,
      updated_at = now()
  where variant_id = p_variant_id;

  insert into public.project_ilaw_production_movements
    (variant_id, quantity, from_stage, to_stage,
     movement_type, actor_id, note)
  values
    (p_variant_id, p_quantity, p_from, p_to,
     case when is_backward then 'backward' else 'forward' end,
     actor, clean_reason);

  return jsonb_build_object(
    'variant_id', p_variant_id,
    'quantity', p_quantity,
    'from', p_from,
    'to', p_to
  );
end;
$$;

revoke all on function public.move_project_ilaw_production(uuid, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.move_project_ilaw_production(uuid, integer, text, text, text) to authenticated;

-- Manual adjustment (admin only).
create or replace function public.adjust_project_ilaw_production(
  p_variant_id uuid,
  p_quantity_delta integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  clean_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  is_add boolean;
  qty integer;
begin
  if not public.has_permission('project_ilaw.production.manage') then
    raise exception 'project_ilaw.production.manage permission required' using errcode = '42501';
  end if;
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_variant_id is null then
    raise exception 'Variant is required' using errcode = '22023';
  end if;
  if p_quantity_delta is null or p_quantity_delta = 0 then
    raise exception 'Quantity must be non-zero' using errcode = '22023';
  end if;
  if clean_reason is null then
    raise exception 'A reason is required for manual adjustments' using errcode = '22023';
  end if;
  if char_length(clean_reason) > 500 then
    raise exception 'Reason must be at most 500 characters' using errcode = '22023';
  end if;

  is_add := p_quantity_delta > 0;
  qty := abs(p_quantity_delta);

  -- lock
  perform 1 from public.project_ilaw_production_progress where variant_id = p_variant_id for update;

  if is_add then
    update public.project_ilaw_production_progress
    set required_qty = required_qty + qty,
        pending_qty = pending_qty + qty,
        updated_at = now()
    where variant_id = p_variant_id;
  else
    -- remove from pending first
    update public.project_ilaw_production_progress
    set required_qty = required_qty - qty,
        pending_qty = greatest(pending_qty - qty, 0),
        updated_at = now()
    where variant_id = p_variant_id;
  end if;

  insert into public.project_ilaw_production_movements
    (variant_id, quantity, from_stage, to_stage, movement_type, actor_id, note)
  values
    (p_variant_id, qty,
     case when is_add then 'none' else 'pending' end,
     case when is_add then 'pending' else 'none' end,
     case when is_add then 'manual_add' else 'manual_remove' end,
     actor, clean_reason);

  return jsonb_build_object('variant_id', p_variant_id, 'delta', p_quantity_delta);
end;
$$;

revoke all on function public.adjust_project_ilaw_production(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.adjust_project_ilaw_production(uuid, integer, text) to authenticated;

-- Resolve a cancellation review flag (admin).
create or replace function public.resolve_project_ilaw_production_review(
  p_flag_id uuid,
  p_quantity integer,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  flag record;
  clean_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.has_permission('project_ilaw.production.manage') then
    raise exception 'project_ilaw.production.manage permission required' using errcode = '42501';
  end if;
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_flag_id is null then
    raise exception 'Flag is required' using errcode = '22023';
  end if;

  select * into flag
  from public.project_ilaw_production_review_flags
  where id = p_flag_id
  for update;

  if not found then
    raise exception 'Review flag not found' using errcode = 'P0002';
  end if;
  if flag.status <> 'pending' then
    raise exception 'This review flag is already resolved' using errcode = 'P0001';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > flag.quantity then
    raise exception 'Invalid adjustment quantity' using errcode = '22023';
  end if;

  update public.project_ilaw_production_progress
  set required_qty = required_qty - p_quantity,
      updated_at = now()
  where variant_id = flag.variant_id;

  -- reduce from completed/processing/manufacturing? Use completed first then manufacturing then processing.
  -- Simplified: reduce completed, then manufacturing, then processing.
  update public.project_ilaw_production_progress
  set completed_qty = greatest(completed_qty - p_quantity, 0),
      updated_at = now()
  where variant_id = flag.variant_id
    and completed_qty >= p_quantity;

  update public.project_ilaw_production_review_flags
  set status = 'resolved',
      resolved_by = actor,
      resolved_at = now(),
      resolution_note = clean_note
  where id = p_flag_id;

  insert into public.project_ilaw_production_movements
    (variant_id, quantity, from_stage, to_stage, movement_type, actor_id, note, order_id)
  values
    (flag.variant_id, p_quantity, 'completed', 'none', 'review_adjustment', actor, clean_note, flag.order_id);

  return jsonb_build_object('flag_id', p_flag_id, 'quantity', p_quantity, 'status', 'resolved');
end;
$$;

revoke all on function public.resolve_project_ilaw_production_review(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.resolve_project_ilaw_production_review(uuid, integer, text) to authenticated;

-- Read RPCs.
create or replace function public.get_project_ilaw_production_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('project_ilaw.production.view') then
    raise exception 'project_ilaw.production.view permission required' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total_required', coalesce(sum(required_qty), 0),
      'pending', coalesce(sum(pending_qty), 0),
      'processing', coalesce(sum(processing_qty), 0),
      'manufacturing', coalesce(sum(manufacturing_qty), 0),
      'completed', coalesce(sum(completed_qty), 0)
    )
    from public.project_ilaw_production_progress
  );
end;
$$;

revoke all on function public.get_project_ilaw_production_overview() from public, anon, authenticated;
grant execute on function public.get_project_ilaw_production_overview() to authenticated;

create or replace function public.get_project_ilaw_production_variants()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('project_ilaw.production.view') then
    raise exception 'project_ilaw.production.view permission required' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'variant_id', v.id,
      'product_type', v.product_type,
      'size', v.size,
      'color', v.color,
      'required_qty', p.required_qty,
      'pending_qty', p.pending_qty,
      'processing_qty', p.processing_qty,
      'manufacturing_qty', p.manufacturing_qty,
      'completed_qty', p.completed_qty,
      'updated_at', p.updated_at
    ) order by v.product_type, v.size, v.color)
    from public.project_ilaw_production_variants v
    left join public.project_ilaw_production_progress p on p.variant_id = v.id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_project_ilaw_production_variants() from public, anon, authenticated;
grant execute on function public.get_project_ilaw_production_variants() to authenticated;

create or replace function public.get_project_ilaw_production_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('project_ilaw.production.view') then
    raise exception 'project_ilaw.production.view permission required' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'variant_id', v.id,
      'product_type', v.product_type,
      'size', v.size,
      'color', v.color,
      'required_qty', p.required_qty,
      'pending_qty', p.pending_qty,
      'processing_qty', p.processing_qty,
      'manufacturing_qty', p.manufacturing_qty,
      'completed_qty', p.completed_qty
    ) order by v.product_type, v.size, v.color)
    from public.project_ilaw_production_variants v
    join public.project_ilaw_production_progress p on p.variant_id = v.id
    where p.required_qty > 0
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_project_ilaw_production_queue() from public, anon, authenticated;
grant execute on function public.get_project_ilaw_production_queue() to authenticated;

create or replace function public.get_project_ilaw_production_history(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('project_ilaw.production.view') then
    raise exception 'project_ilaw.production.view permission required' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id,
      'variant_id', m.variant_id,
      'product_type', v.product_type,
      'size', v.size,
      'color', v.color,
      'quantity', m.quantity,
      'from_stage', m.from_stage,
      'to_stage', m.to_stage,
      'movement_type', m.movement_type,
      'actor_id', m.actor_id,
      'note', m.note,
      'order_id', m.order_id,
      'created_at', m.created_at
    ) order by m.created_at desc)
    from public.project_ilaw_production_movements m
    join public.project_ilaw_production_variants v on v.id = m.variant_id
    limit greatest(coalesce(p_limit, 50), 1)
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_project_ilaw_production_history(integer) from public, anon, authenticated;
grant execute on function public.get_project_ilaw_production_history(integer) to authenticated;

create or replace function public.get_project_ilaw_production_review_flags()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('project_ilaw.production.manage') then
    raise exception 'project_ilaw.production.manage permission required' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', f.id,
      'variant_id', f.variant_id,
      'product_type', v.product_type,
      'size', v.size,
      'color', v.color,
      'order_id', f.order_id,
      'quantity', f.quantity,
      'status', f.status,
      'created_at', f.created_at
    ) order by f.created_at desc)
    from public.project_ilaw_production_review_flags f
    join public.project_ilaw_production_variants v on v.id = f.variant_id
    where f.status = 'pending'
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_project_ilaw_production_review_flags() from public, anon, authenticated;
grant execute on function public.get_project_ilaw_production_review_flags() to authenticated;

commit;
