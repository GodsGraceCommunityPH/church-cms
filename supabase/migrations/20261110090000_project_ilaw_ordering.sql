-- Project Ilaw Phase 2: multi-item ordering, manual payment confirmation,
-- fulfilment tracking, append-only activity history, and accounting exports.
--
-- Security model:
--   * Public customers may only call submit_project_ilaw_order().
--   * Order, line-item, and activity rows have RLS and are readable only by
--     holders of project_ilaw.orders.view.
--   * No table write privileges are granted to anon or authenticated. Every
--     mutation goes through a security-definer function that re-checks the
--     caller's CMS permission.
--   * Order totals are computed from trusted server-side prices, and a
--     deferred constraint trigger verifies the header against its line items.

begin;

insert into public.permissions (code, name, module, description) values
  ('project_ilaw.orders.view', 'View Project Ilaw orders', 'project_ilaw', 'View Project Ilaw order details, line items, and activity history.'),
  ('project_ilaw.orders.confirm_payment', 'Confirm Project Ilaw payments', 'project_ilaw', 'Manually confirm that a Project Ilaw order has been paid.'),
  ('project_ilaw.orders.manage', 'Manage Project Ilaw orders', 'project_ilaw', 'Amend Project Ilaw orders, update fulfilment, and cancel orders.'),
  ('project_ilaw.orders.export', 'Export Project Ilaw orders', 'project_ilaw', 'Export permission-scoped Project Ilaw order line items as CSV.')
on conflict (code) do update
set name = excluded.name,
    module = excluded.module,
    description = excluded.description,
    updated_at = now();

-- A dedicated least-privilege role for the Project Ilaw order volunteers. It
-- grants exactly view + confirm_payment, so Bryan does not need an
-- administrator, finance, or any unrelated role. The role is assigned to a
-- verified existing account by an administrator; this migration never creates
-- Auth accounts or guesses a user id.
insert into public.roles (code, name, description, is_system)
values (
  'project_ilaw_orders_staff',
  'Project Ilaw Orders Staff',
  'View Project Ilaw orders and manually confirm payments. No fulfilment, export, or other module access.',
  true
)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    updated_at = now();

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles role
join public.permissions permission
  on permission.code in (
    'project_ilaw.orders.view',
    'project_ilaw.orders.confirm_payment'
  )
where role.code = 'project_ilaw_orders_staff'
on conflict (role_id, permission_id) do nothing;

-- Administrators already hold every module permission by convention. No other
-- role is granted Project Ilaw access by default.
insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles role
join public.permissions permission on permission.code like 'project_ilaw.orders.%'
where role.code = 'administrator'
on conflict (role_id, permission_id) do nothing;

create sequence if not exists public.project_ilaw_order_reference_seq;

create or replace function public.next_project_ilaw_order_reference()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'PI-'
    || to_char(now() at time zone 'Asia/Manila', 'YYYYMMDD')
    || '-'
    || lpad(nextval('public.project_ilaw_order_reference_seq')::text, 6, '0');
$$;

revoke all on function public.next_project_ilaw_order_reference() from public, anon, authenticated;

create table if not exists public.project_ilaw_orders (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  reference text not null unique,
  customer_name text not null,
  mobile text not null,
  notes text,
  total_quantity integer not null,
  total_amount integer not null,
  payment_status text not null default 'awaiting_payment',
  fulfillment_status text not null default 'not_started',
  payment_confirmed_at timestamptz,
  payment_confirmed_by uuid references public.users(id) on delete set null,
  payment_note text,
  cancelled_at timestamptz,
  cancelled_by uuid references public.users(id) on delete set null,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_ilaw_orders_customer_name_check check (btrim(customer_name) <> ''),
  constraint project_ilaw_orders_mobile_check check (btrim(mobile) <> ''),
  constraint project_ilaw_orders_total_quantity_check check (total_quantity > 0),
  constraint project_ilaw_orders_total_amount_check check (total_amount > 0),
  constraint project_ilaw_orders_payment_status_check check (payment_status in ('awaiting_payment', 'payment_confirmed')),
  constraint project_ilaw_orders_fulfillment_status_check check (fulfillment_status in ('not_started', 'processing', 'ready_for_pickup', 'completed', 'cancelled')),
  constraint project_ilaw_orders_payment_consistency_check check (
    (payment_status = 'awaiting_payment' and payment_confirmed_at is null)
    or (payment_status = 'payment_confirmed' and payment_confirmed_at is not null)
  ),
  constraint project_ilaw_orders_cancel_consistency_check check (
    fulfillment_status <> 'cancelled' or cancelled_at is not null
  )
);

create index if not exists project_ilaw_orders_created_idx
  on public.project_ilaw_orders (created_at desc);
create index if not exists project_ilaw_orders_payment_idx
  on public.project_ilaw_orders (payment_status, created_at desc);
create index if not exists project_ilaw_orders_fulfillment_idx
  on public.project_ilaw_orders (fulfillment_status, created_at desc);

create table if not exists public.project_ilaw_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.project_ilaw_orders(id) on delete restrict,
  revision integer not null default 1,
  line_number integer not null,
  product_id text not null,
  product_name text not null,
  product_type text not null,
  size text not null,
  quantity integer not null,
  unit_price integer not null,
  line_total integer generated always as (quantity * unit_price) stored,
  superseded_at timestamptz,
  superseded_by_revision integer,
  created_at timestamptz not null default now(),
  constraint project_ilaw_order_items_revision_check check (revision > 0),
  constraint project_ilaw_order_items_line_number_check check (line_number > 0),
  constraint project_ilaw_order_items_quantity_check check (quantity > 0 and quantity <= 99),
  constraint project_ilaw_order_items_price_check check (unit_price = 499),
  constraint project_ilaw_order_items_product_size_check check (
    (
      product_id = 'project-ilaw-t-shirt'
      and product_name = 'Project Ilaw T-shirt'
      and product_type = 't_shirt'
      and size in ('XS', 'S', 'M', 'L', 'XL', '2XL', '3XL')
    )
    or (
      product_id = 'project-ilaw-eco-bag'
      and product_name = 'Project Ilaw Eco Bag'
      and product_type = 'eco_bag'
      and size = 'One Size'
    )
  )
);

create unique index if not exists project_ilaw_order_items_revision_line_unique
  on public.project_ilaw_order_items (order_id, revision, line_number);
create unique index if not exists project_ilaw_order_items_active_line_unique
  on public.project_ilaw_order_items (order_id, line_number)
  where superseded_at is null;
create index if not exists project_ilaw_order_items_active_order_idx
  on public.project_ilaw_order_items (order_id)
  where superseded_at is null;

create table if not exists public.project_ilaw_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.project_ilaw_orders(id) on delete restrict,
  event_type text not null,
  actor_id uuid references public.users(id) on delete set null,
  actor_type text not null default 'user',
  previous_value jsonb,
  new_value jsonb,
  note text,
  created_at timestamptz not null default now(),
  constraint project_ilaw_order_events_type_check check (
    event_type in ('order_created', 'payment_confirmed', 'fulfillment_changed', 'order_amended', 'order_cancelled')
  ),
  constraint project_ilaw_order_events_actor_type_check check (actor_type in ('anonymous', 'user', 'system'))
);

create index if not exists project_ilaw_order_events_order_idx
  on public.project_ilaw_order_events (order_id, created_at desc);

create or replace function public.prevent_project_ilaw_order_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Project Ilaw order activity is append-only' using errcode = '42501';
end;
$$;

revoke all on function public.prevent_project_ilaw_order_event_mutation() from public, anon, authenticated;

drop trigger if exists project_ilaw_order_events_append_only on public.project_ilaw_order_events;
create trigger project_ilaw_order_events_append_only
before update or delete on public.project_ilaw_order_events
for each row execute function public.prevent_project_ilaw_order_event_mutation();

-- Validate and snapshot line items using trusted server-side catalogue data.
create or replace function public.project_ilaw_validated_items(p_items jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  item jsonb;
  item_count integer;
  product_id text;
  size text;
  product_name text;
  product_type text;
  quantity_number numeric;
  quantity integer;
  total_quantity integer := 0;
  total_amount integer := 0;
  snapshot jsonb := '[]'::jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'At least one order item is required' using errcode = '22023';
  end if;

  item_count := jsonb_array_length(p_items);
  if item_count < 1 or item_count > 20 then
    raise exception 'An order must contain between 1 and 20 line items' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'Invalid order item' using errcode = '22023';
    end if;

    product_id := btrim(coalesce(item ->> 'productId', ''));
    size := btrim(coalesce(item ->> 'size', ''));

    if not (item ? 'quantity') or jsonb_typeof(item -> 'quantity') is distinct from 'number' then
      raise exception 'Quantity must be a positive whole number' using errcode = '22023';
    end if;

    quantity_number := (item ->> 'quantity')::numeric;
    if quantity_number <= 0
       or quantity_number <> trunc(quantity_number)
       or quantity_number > 99 then
      raise exception 'Quantity must be a positive whole number up to 99' using errcode = '22023';
    end if;
    quantity := quantity_number::integer;

    if product_id = 'project-ilaw-t-shirt' then
      if size not in ('XS', 'S', 'M', 'L', 'XL', '2XL', '3XL') then
        raise exception 'Select a valid T-shirt size' using errcode = '22023';
      end if;
      product_name := 'Project Ilaw T-shirt';
      product_type := 't_shirt';
    elsif product_id = 'project-ilaw-eco-bag' then
      if size <> 'One Size' then
        raise exception 'The eco bag is only available in One Size' using errcode = '22023';
      end if;
      product_name := 'Project Ilaw Eco Bag';
      product_type := 'eco_bag';
    else
      raise exception 'Unknown Project Ilaw product' using errcode = '22023';
    end if;

    total_quantity := total_quantity + quantity;
    total_amount := total_amount + (quantity * 499);
    snapshot := snapshot || jsonb_build_array(jsonb_build_object(
      'product_id', product_id,
      'product_name', product_name,
      'product_type', product_type,
      'size', size,
      'quantity', quantity,
      'unit_price', 499,
      'line_total', quantity * 499
    ));
  end loop;

  return jsonb_build_object(
    'items', snapshot,
    'total_quantity', total_quantity,
    'total_amount', total_amount
  );
end;
$$;

revoke all on function public.project_ilaw_validated_items(jsonb) from public, anon, authenticated;

create or replace function public.verify_project_ilaw_order_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

  if not exists (select 1 from public.project_ilaw_orders where id = target_order_id) then
    return null;
  end if;

  select coalesce(sum(quantity), 0), coalesce(sum(line_total), 0)
  into active_quantity, active_amount
  from public.project_ilaw_order_items
  where order_id = target_order_id and superseded_at is null;

  if exists (
    select 1 from public.project_ilaw_orders
    where id = target_order_id
      and (total_quantity <> active_quantity or total_amount <> active_amount)
  ) then
    raise exception 'Project Ilaw order totals do not match its active line items' using errcode = '23514';
  end if;

  return null;
end;
$$;

revoke all on function public.verify_project_ilaw_order_totals() from public, anon, authenticated;

drop trigger if exists project_ilaw_order_items_totals_check on public.project_ilaw_order_items;
create constraint trigger project_ilaw_order_items_totals_check
after insert or update or delete on public.project_ilaw_order_items
deferrable initially deferred
for each row execute function public.verify_project_ilaw_order_totals();

create or replace function public.project_ilaw_order_snapshot(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'customer_name', orders.customer_name,
    'mobile', orders.mobile,
    'notes', orders.notes,
    'total_quantity', orders.total_quantity,
    'total_amount', orders.total_amount,
    'payment_status', orders.payment_status,
    'fulfillment_status', orders.fulfillment_status,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', items.product_id,
        'product_name', items.product_name,
        'product_type', items.product_type,
        'size', items.size,
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
$$;

revoke all on function public.project_ilaw_order_snapshot(uuid) from public, anon, authenticated;

alter table public.project_ilaw_orders enable row level security;
alter table public.project_ilaw_order_items enable row level security;
alter table public.project_ilaw_order_events enable row level security;

revoke all on public.project_ilaw_orders, public.project_ilaw_order_items, public.project_ilaw_order_events from public, anon, authenticated;
grant select on public.project_ilaw_orders, public.project_ilaw_order_items, public.project_ilaw_order_events to authenticated;

drop policy if exists "Project Ilaw viewers read orders" on public.project_ilaw_orders;
create policy "Project Ilaw viewers read orders" on public.project_ilaw_orders
for select to authenticated
using (public.has_permission('project_ilaw.orders.view'));

drop policy if exists "Project Ilaw viewers read order items" on public.project_ilaw_order_items;
create policy "Project Ilaw viewers read order items" on public.project_ilaw_order_items
for select to authenticated
using (public.has_permission('project_ilaw.orders.view'));

drop policy if exists "Project Ilaw viewers read order activity" on public.project_ilaw_order_events;
create policy "Project Ilaw viewers read order activity" on public.project_ilaw_order_events
for select to authenticated
using (public.has_permission('project_ilaw.orders.view'));

-- Extend the existing notification infrastructure for permission-scoped
-- Project Ilaw order alerts without widening member notifications.
alter table public.notifications
  add column if not exists related_order_id uuid references public.project_ilaw_orders(id) on delete set null;

alter table public.notifications drop constraint if exists notifications_event_type_check;
alter table public.notifications add constraint notifications_event_type_check check (
  event_type in (
    'new_member_registered',
    'member_profile_updated',
    'member_archived',
    'member_removed',
    'project_ilaw_order_created'
  )
);

drop policy if exists "Member viewers read own notifications" on public.notifications;
create policy "Member viewers read own notifications" on public.notifications
for select to authenticated using (
  recipient_id = auth.uid()
  and (
    public.has_permission('members.view')
    or public.has_permission('project_ilaw.orders.view')
  )
);

drop policy if exists "Member viewers mark own notifications read" on public.notifications;
create policy "Member viewers mark own notifications read" on public.notifications
for update to authenticated using (
  recipient_id = auth.uid()
  and (
    public.has_permission('members.view')
    or public.has_permission('project_ilaw.orders.view')
  )
) with check (
  recipient_id = auth.uid()
  and (
    public.has_permission('members.view')
    or public.has_permission('project_ilaw.orders.view')
  )
);

create or replace function public.submit_project_ilaw_order(
  p_request_id uuid,
  p_customer_name text,
  p_mobile text,
  p_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.project_ilaw_orders%rowtype;
  created public.project_ilaw_orders%rowtype;
  validated jsonb;
  snapshot_items jsonb;
  line_number integer := 0;
  item jsonb;
  recipient uuid;
  clean_name text := btrim(coalesce(p_customer_name, ''));
  clean_mobile text := btrim(coalesce(p_mobile, ''));
  clean_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  digits text;
begin
  if p_request_id is null then
    raise exception 'A request identifier is required' using errcode = '22023';
  end if;

  if clean_name = '' or char_length(clean_name) > 120 then
    raise exception 'Customer name is required and must be at most 120 characters' using errcode = '22023';
  end if;

  digits := regexp_replace(clean_mobile, '[^0-9]', '', 'g');
  if clean_mobile = ''
     or char_length(clean_mobile) > 32
     or char_length(digits) < 10
     or char_length(digits) > 15 then
    raise exception 'A valid mobile number is required' using errcode = '22023';
  end if;

  if clean_notes is not null and char_length(clean_notes) > 1000 then
    raise exception 'Order notes must be at most 1000 characters' using errcode = '22023';
  end if;

  validated := public.project_ilaw_validated_items(p_items);
  snapshot_items := validated -> 'items';

  -- Serialize retries for the same browser-generated request id. A repeated
  -- click or retry returns the original order instead of creating a duplicate.
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));

  select * into existing
  from public.project_ilaw_orders
  where client_request_id = p_request_id;

  if found then
    return jsonb_build_object(
      'order_id', existing.id,
      'reference', existing.reference,
      'total_quantity', existing.total_quantity,
      'total_amount', existing.total_amount,
      'payment_status', existing.payment_status,
      'fulfillment_status', existing.fulfillment_status,
      'created_at', existing.created_at,
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
    total_amount
  ) values (
    p_request_id,
    public.next_project_ilaw_order_reference(),
    clean_name,
    clean_mobile,
    clean_notes,
    (validated ->> 'total_quantity')::integer,
    (validated ->> 'total_amount')::integer
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
      (item ->> 'quantity')::integer,
      499
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
    null,
    'anonymous',
    jsonb_build_object(
      'customer_name', created.customer_name,
      'mobile', created.mobile,
      'notes', created.notes,
      'total_quantity', created.total_quantity,
      'total_amount', created.total_amount,
      'items', snapshot_items
    )
  );

  for recipient in
    select distinct users.id
    from public.users users
    join public.user_roles user_roles on user_roles.user_id = users.id
    join public.role_permissions role_permissions on role_permissions.role_id = user_roles.role_id
    join public.permissions permissions on permissions.id = role_permissions.permission_id
    where users.is_active
      and permissions.code = 'project_ilaw.orders.view'
  loop
    insert into public.notifications (
      recipient_id,
      event_type,
      title,
      message,
      related_order_id
    ) values (
      recipient,
      'project_ilaw_order_created',
      'New Project Ilaw Order',
      'Order ' || created.reference || ' from ' || created.customer_name
        || ' (' || created.total_quantity || ' item'
        || case when created.total_quantity = 1 then '' else 's' end
        || ', ₱' || created.total_amount || ').',
      created.id
    );
  end loop;

  return jsonb_build_object(
    'order_id', created.id,
    'reference', created.reference,
    'total_quantity', created.total_quantity,
    'total_amount', created.total_amount,
    'payment_status', created.payment_status,
    'fulfillment_status', created.fulfillment_status,
    'created_at', created.created_at,
    'duplicate', false
  );
end;
$$;

revoke all on function public.submit_project_ilaw_order(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_project_ilaw_order(uuid, text, text, text, jsonb) to anon, authenticated;

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
  if target.payment_status = 'payment_confirmed' then
    raise exception 'Payment is already confirmed' using errcode = 'P0001';
  end if;
  if target.fulfillment_status = 'cancelled' then
    raise exception 'A cancelled order cannot be confirmed as paid' using errcode = 'P0001';
  end if;

  update public.project_ilaw_orders
  set payment_status = 'payment_confirmed',
      payment_confirmed_at = now(),
      payment_confirmed_by = actor,
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
    jsonb_build_object('payment_status', 'awaiting_payment'),
    jsonb_build_object(
      'payment_status', 'payment_confirmed',
      'payment_confirmed_at', target.payment_confirmed_at,
      'payment_confirmed_by', actor
    ),
    clean_note
  );

  return jsonb_build_object(
    'order_id', target.id,
    'reference', target.reference,
    'payment_status', target.payment_status,
    'payment_confirmed_at', target.payment_confirmed_at,
    'payment_confirmed_by', target.payment_confirmed_by,
    'payment_note', target.payment_note
  );
end;
$$;

revoke all on function public.confirm_project_ilaw_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_project_ilaw_payment(uuid, text) to authenticated;

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
  if clean_status not in ('processing', 'ready_for_pickup', 'completed', 'cancelled') then
    raise exception 'Invalid fulfilment status' using errcode = '22023';
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
    raise exception 'Order already has that fulfilment status' using errcode = 'P0001';
  end if;

  previous_status := target.fulfillment_status;

  if clean_status = 'cancelled' then
    if previous_status not in ('not_started', 'processing', 'ready_for_pickup') then
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
      order_id,
      event_type,
      actor_id,
      actor_type,
      previous_value,
      new_value,
      note
    ) values (
      target.id,
      'order_cancelled',
      actor,
      'user',
      jsonb_build_object('fulfillment_status', previous_status),
      jsonb_build_object(
        'fulfillment_status', 'cancelled',
        'cancelled_at', target.cancelled_at,
        'cancelled_by', actor
      ),
      clean_note
    );
  else
    if not (
      (previous_status = 'not_started' and clean_status in ('processing', 'ready_for_pickup'))
      or (previous_status = 'processing' and clean_status = 'ready_for_pickup')
      or (previous_status = 'ready_for_pickup' and clean_status = 'completed')
    ) then
      raise exception 'Invalid fulfilment status transition' using errcode = 'P0001';
    end if;

    update public.project_ilaw_orders
    set fulfillment_status = clean_status,
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
      'fulfillment_changed',
      actor,
      'user',
      jsonb_build_object('fulfillment_status', previous_status),
      jsonb_build_object('fulfillment_status', clean_status),
      clean_note
    );
  end if;

  return jsonb_build_object(
    'order_id', target.id,
    'reference', target.reference,
    'fulfillment_status', target.fulfillment_status,
    'cancelled_at', target.cancelled_at,
    'cancel_reason', target.cancel_reason
  );
end;
$$;

revoke all on function public.update_project_ilaw_fulfillment(uuid, text, text) from public, anon, authenticated;
grant execute on function public.update_project_ilaw_fulfillment(uuid, text, text) to authenticated;

create or replace function public.cancel_project_ilaw_order(
  p_order_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.update_project_ilaw_fulfillment(p_order_id, 'cancelled', p_reason);
end;
$$;

revoke all on function public.cancel_project_ilaw_order(uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_project_ilaw_order(uuid, text) to authenticated;

create or replace function public.amend_project_ilaw_order(
  p_order_id uuid,
  p_customer_name text,
  p_mobile text,
  p_notes text,
  p_items jsonb,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.project_ilaw_orders%rowtype;
  validated jsonb;
  snapshot_items jsonb;
  previous_snapshot jsonb;
  new_snapshot jsonb;
  next_revision integer;
  line_number integer := 0;
  item jsonb;
  actor uuid := auth.uid();
  clean_name text := btrim(coalesce(p_customer_name, ''));
  clean_mobile text := btrim(coalesce(p_mobile, ''));
  clean_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  clean_note text := nullif(btrim(coalesce(p_note, '')), '');
  digits text;
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
  if clean_name = '' or char_length(clean_name) > 120 then
    raise exception 'Customer name is required and must be at most 120 characters' using errcode = '22023';
  end if;
  digits := regexp_replace(clean_mobile, '[^0-9]', '', 'g');
  if clean_mobile = ''
     or char_length(clean_mobile) > 32
     or char_length(digits) < 10
     or char_length(digits) > 15 then
    raise exception 'A valid mobile number is required' using errcode = '22023';
  end if;
  if clean_notes is not null and char_length(clean_notes) > 1000 then
    raise exception 'Order notes must be at most 1000 characters' using errcode = '22023';
  end if;
  if clean_note is not null and char_length(clean_note) > 1000 then
    raise exception 'Amendment note must be at most 1000 characters' using errcode = '22023';
  end if;

  select * into target
  from public.project_ilaw_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if target.fulfillment_status in ('completed', 'cancelled') then
    raise exception 'A completed or cancelled order cannot be amended' using errcode = 'P0001';
  end if;

  previous_snapshot := public.project_ilaw_order_snapshot(target.id);
  validated := public.project_ilaw_validated_items(p_items);
  snapshot_items := validated -> 'items';

  select coalesce(max(revision), 0) + 1 into next_revision
  from public.project_ilaw_order_items
  where order_id = target.id;

  update public.project_ilaw_order_items
  set superseded_at = now(),
      superseded_by_revision = next_revision
  where order_id = target.id
    and superseded_at is null;

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
      quantity,
      unit_price
    ) values (
      target.id,
      next_revision,
      line_number,
      item ->> 'product_id',
      item ->> 'product_name',
      item ->> 'product_type',
      item ->> 'size',
      (item ->> 'quantity')::integer,
      499
    );
  end loop;

  update public.project_ilaw_orders
  set customer_name = clean_name,
      mobile = clean_mobile,
      notes = clean_notes,
      total_quantity = (validated ->> 'total_quantity')::integer,
      total_amount = (validated ->> 'total_amount')::integer,
      updated_at = now()
  where id = target.id
  returning * into target;

  new_snapshot := public.project_ilaw_order_snapshot(target.id);

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
    'order_amended',
    actor,
    'user',
    previous_snapshot,
    new_snapshot,
    clean_note
  );

  return jsonb_build_object(
    'order_id', target.id,
    'reference', target.reference,
    'total_quantity', target.total_quantity,
    'total_amount', target.total_amount,
    'revision', next_revision
  );
end;
$$;

revoke all on function public.amend_project_ilaw_order(uuid, text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.amend_project_ilaw_order(uuid, text, text, text, jsonb, text) to authenticated;

create or replace function public.get_project_ilaw_order_activity(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('project_ilaw.orders.view') then
    raise exception 'project_ilaw.orders.view permission required' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', events.id,
      'event_type', events.event_type,
      'actor_id', events.actor_id,
      'actor_type', events.actor_type,
      'actor_name', case
        when events.actor_type = 'anonymous' then 'Customer (anonymous)'
        when events.actor_type = 'system' then 'System'
        else coalesce(users.display_name, 'Staff member')
      end,
      'previous_value', events.previous_value,
      'new_value', events.new_value,
      'note', events.note,
      'created_at', events.created_at
    ) order by events.created_at desc, events.id desc), '[]'::jsonb)
    from public.project_ilaw_order_events events
    left join public.users users on users.id = events.actor_id
    where events.order_id = p_order_id
  );
end;
$$;

revoke all on function public.get_project_ilaw_order_activity(uuid) from public, anon, authenticated;
grant execute on function public.get_project_ilaw_order_activity(uuid) to authenticated;

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
      'quantity', items.quantity,
      'unit_price', items.unit_price,
      'line_total', items.line_total,
      'payment_status', orders.payment_status,
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

revoke all on function public.project_ilaw_export_rows(date, date, text, text, text) from public, anon, authenticated;
grant execute on function public.project_ilaw_export_rows(date, date, text, text, text) to authenticated;

commit;
