-- Update Project Ilaw Eco Bag price while keeping T-shirts at ₱499.
-- Existing orders retain their original price snapshots.

begin;

do $$
declare
  fn text;
begin
  -- Shared validator: price each product independently and snapshot the price.
  fn := pg_get_functiondef('public.project_ilaw_validated_items(jsonb)'::regprocedure);
  fn := replace(fn, '  quantity integer;' || E'\n', '  quantity integer;' || E'\n  unit_price integer;' || E'\n');
  fn := replace(fn,
    '    total_quantity := total_quantity + quantity;' || E'\n' ||
    '    total_amount := total_amount + (quantity * 499);',
    '    unit_price := case when product_id = ''project-ilaw-eco-bag'' then 399 else 499 end;' || E'\n' ||
    '    total_quantity := total_quantity + quantity;' || E'\n' ||
    '    total_amount := total_amount + (quantity * unit_price);'
  );
  fn := replace(fn, '''unit_price'', 499', '''unit_price'', unit_price');
  fn := replace(fn, '''line_total'', quantity * 499', '''line_total'', quantity * unit_price');
  execute fn;

  -- Keep the legacy 5-argument and current 6-argument submission RPCs aligned.
  fn := pg_get_functiondef('public.submit_project_ilaw_order(uuid,text,text,text,jsonb)'::regprocedure);
  fn := replace(fn,
    E'      (item ->> ''quantity'')::integer,\n      499',
    E'      (item ->> ''quantity'')::integer,\n      (item ->> ''unit_price'')::integer'
  );
  execute fn;

  fn := pg_get_functiondef('public.submit_project_ilaw_order(uuid,text,text,text,jsonb,text)'::regprocedure);
  fn := replace(fn,
    E'      (item ->> ''quantity'')::integer, 499',
    E'      (item ->> ''quantity'')::integer, (item ->> ''unit_price'')::integer'
  );
  execute fn;

  -- Order amendments also use the validated per-product snapshot price.
  fn := pg_get_functiondef('public.amend_project_ilaw_order(uuid,text,text,text,jsonb,text)'::regprocedure);
  fn := replace(fn,
    E'      (item ->> ''quantity'')::integer,\n      499',
    E'      (item ->> ''quantity'')::integer,\n      (item ->> ''unit_price'')::integer'
  );
  execute fn;
end;
$$;

commit;