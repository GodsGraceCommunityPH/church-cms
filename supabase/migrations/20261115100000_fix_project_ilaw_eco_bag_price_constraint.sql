-- Keep order-item prices aligned with the Project Ilaw product catalog.
-- T-shirts are PHP 499; Eco Bags are PHP 399.

begin;

alter table public.project_ilaw_order_items
  drop constraint if exists project_ilaw_order_items_price_check;

alter table public.project_ilaw_order_items
  add constraint project_ilaw_order_items_price_check
  check (
    (product_id = 'project-ilaw-t-shirt' and unit_price = 499)
    or
    (product_id = 'project-ilaw-eco-bag' and unit_price = 399)
  );

commit;
