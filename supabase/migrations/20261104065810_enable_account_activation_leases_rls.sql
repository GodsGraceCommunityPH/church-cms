begin;

-- Defense in depth: only service_role has table privileges.
alter table public.account_activation_leases enable row level security;

commit;
