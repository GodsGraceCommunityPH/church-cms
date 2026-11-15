-- Keep the Project Ilaw Orders Staff role description aligned with its
-- existing permissions as well as its newly added restricted amendment access.
update public.roles
set description =
  'View Project Ilaw orders and production; confirm payments; create staff-assisted orders; advance fulfillment; export orders and production data; move existing production quantities between adjacent stages; and amend quantities/colours and T-shirt sizes on existing order lines only. Amendments cannot change customer details, products, line count, or notes. No settings changes.'
where code = 'project_ilaw_orders_staff';
