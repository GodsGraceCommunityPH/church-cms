-- Fix: project_ilaw_sync_production_for_order had a type mismatch
-- (select production_synced (boolean) into actor (uuid)), which caused
-- every cash/GCash payment confirmation to fail. Remove the unused variable.

create or replace function public.project_ilaw_sync_production_for_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
  v_variant_id uuid;
begin
  if p_order_id is null then return; end if;

  if (select production_synced from public.project_ilaw_orders where id = p_order_id) then
    return;
  end if;

  for item in
    select product_id, size, color, quantity
    from public.project_ilaw_order_items
    where order_id = p_order_id
  loop
    select id into v_variant_id
    from public.project_ilaw_production_variants
    where product_type = case item.product_id
           when 'project-ilaw-t-shirt' then 't_shirt'
           when 'project-ilaw-eco-bag' then 'eco_bag'
         end
      and size = case when item.product_id = 'project-ilaw-eco-bag' then 'One Size' else item.size end
      and color = item.color;

    if v_variant_id is null then continue; end if;

    insert into public.project_ilaw_production_progress (variant_id, required_qty, pending_qty)
    values (v_variant_id, item.quantity, item.quantity)
    on conflict (variant_id) do update
      set required_qty = project_ilaw_production_progress.required_qty + item.quantity,
          pending_qty = project_ilaw_production_progress.pending_qty + item.quantity,
          updated_at = now();

    insert into public.project_ilaw_production_movements
      (variant_id, quantity, from_stage, to_stage, movement_type, order_id, note)
    values
      (v_variant_id, item.quantity, 'none', 'pending', 'auto_add', p_order_id,
       'Added from paid order');
  end loop;

  update public.project_ilaw_orders
  set production_synced = true,
      production_synced_at = now(),
      updated_at = now()
  where id = p_order_id;
end;
$$;

revoke all on function public.project_ilaw_sync_production_for_order(uuid) from public, anon, authenticated;
-- service-role / definer only; no grant needed for clients.
