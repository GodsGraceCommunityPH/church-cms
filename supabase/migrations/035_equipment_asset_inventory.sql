begin;

insert into public.permissions (code, name, module, description) values
  ('equipment.view', 'View equipment inventory', 'equipment', 'View active and archived church equipment and maintenance history.'),
  ('equipment.manage', 'Manage equipment inventory', 'equipment', 'Create, update, archive, and maintain church equipment records.')
on conflict (code) do update set
  name = excluded.name,
  module = excluded.module,
  description = excluded.description,
  updated_at = now();

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles role
join public.permissions permission on permission.code in ('equipment.view', 'equipment.manage')
where role.code = 'administrator'
on conflict (role_id, permission_id) do nothing;

create table if not exists public.equipment_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_categories_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists equipment_categories_name_unique
  on public.equipment_categories (lower(name));

insert into public.equipment_categories (name) values
  ('Audio'), ('Instruments'), ('Media / Tech'), ('Electrical'),
  ('Furniture'), ('Office'), ('Ministry Equipment'), ('Other')
on conflict do nothing;

create table if not exists public.equipment_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tracking_type text not null,
  category_id uuid not null references public.equipment_categories(id),
  quantity integer not null default 1,
  condition text not null,
  description text,
  location text,
  custodian_member_id uuid references public.members(id) on delete set null,
  brand text,
  model text,
  serial_number text,
  asset_tag text,
  purchase_date date,
  purchase_cost numeric(12, 2),
  notes text,
  archived_at timestamptz,
  archived_by uuid references public.users(id) on delete set null,
  created_by uuid references public.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_items_name_not_blank check (btrim(name) <> ''),
  constraint equipment_items_tracking_type_check check (tracking_type in ('individual', 'quantity')),
  constraint equipment_items_quantity_check check (quantity > 0),
  constraint equipment_items_individual_quantity_check check (tracking_type <> 'individual' or quantity = 1),
  constraint equipment_items_condition_check check (condition in ('working', 'damaged', 'for_repair', 'for_replacement', 'retired')),
  constraint equipment_items_purchase_cost_check check (purchase_cost is null or purchase_cost >= 0)
);

create unique index if not exists equipment_items_asset_tag_unique
  on public.equipment_items (lower(asset_tag)) where asset_tag is not null and btrim(asset_tag) <> '';
create index if not exists equipment_items_category_id_idx on public.equipment_items(category_id);
create index if not exists equipment_items_custodian_idx on public.equipment_items(custodian_member_id);
create index if not exists equipment_items_active_idx on public.equipment_items(archived_at, name);

create table if not exists public.equipment_maintenance_history (
  id uuid primary key default gen_random_uuid(),
  equipment_item_id uuid not null references public.equipment_items(id) on delete restrict,
  maintenance_date date not null,
  type text not null,
  status text not null,
  cost numeric(12, 2),
  notes text,
  created_by uuid references public.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_maintenance_type_check check (type in ('inspection', 'repair', 'maintenance', 'replacement_part')),
  constraint equipment_maintenance_status_check check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  constraint equipment_maintenance_cost_check check (cost is null or cost >= 0)
);

create index if not exists equipment_maintenance_item_date_idx
  on public.equipment_maintenance_history(equipment_item_id, maintenance_date desc);

create or replace function public.touch_equipment_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists equipment_categories_touch_updated_at on public.equipment_categories;
create trigger equipment_categories_touch_updated_at before update on public.equipment_categories
for each row execute function public.touch_equipment_updated_at();
drop trigger if exists equipment_items_touch_updated_at on public.equipment_items;
create trigger equipment_items_touch_updated_at before update on public.equipment_items
for each row execute function public.touch_equipment_updated_at();
drop trigger if exists equipment_maintenance_touch_updated_at on public.equipment_maintenance_history;
create trigger equipment_maintenance_touch_updated_at before update on public.equipment_maintenance_history
for each row execute function public.touch_equipment_updated_at();

alter table public.equipment_categories enable row level security;
alter table public.equipment_items enable row level security;
alter table public.equipment_maintenance_history enable row level security;

revoke all on public.equipment_categories, public.equipment_items, public.equipment_maintenance_history from anon;
grant select on public.equipment_categories, public.equipment_items, public.equipment_maintenance_history to authenticated;
grant insert, update on public.equipment_categories, public.equipment_items, public.equipment_maintenance_history to authenticated;

drop policy if exists "Equipment categories view" on public.equipment_categories;
create policy "Equipment categories view" on public.equipment_categories
for select to authenticated using (public.has_permission('equipment.view'));
drop policy if exists "Equipment categories manage" on public.equipment_categories;
create policy "Equipment categories manage" on public.equipment_categories
for all to authenticated using (public.has_permission('equipment.manage'))
with check (public.has_permission('equipment.manage'));

drop policy if exists "Equipment items view" on public.equipment_items;
create policy "Equipment items view" on public.equipment_items
for select to authenticated using (public.has_permission('equipment.view'));
drop policy if exists "Equipment items manage" on public.equipment_items;
create policy "Equipment items manage" on public.equipment_items
for all to authenticated using (public.has_permission('equipment.manage'))
with check (public.has_permission('equipment.manage'));

drop policy if exists "Equipment maintenance view" on public.equipment_maintenance_history;
create policy "Equipment maintenance view" on public.equipment_maintenance_history
for select to authenticated using (public.has_permission('equipment.view'));
drop policy if exists "Equipment maintenance manage" on public.equipment_maintenance_history;
create policy "Equipment maintenance manage" on public.equipment_maintenance_history
for all to authenticated using (public.has_permission('equipment.manage'))
with check (public.has_permission('equipment.manage'));

commit;
