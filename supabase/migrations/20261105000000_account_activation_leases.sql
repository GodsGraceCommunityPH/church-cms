begin;

-- Cross-instance serialization for account activation.
-- This table is a lease/state store; it is not an audit log. Rows are deleted
-- when an operation finishes or expires. It is intended to be applied before the
-- updated manage-cms-users Edge Function is deployed.

create table if not exists public.account_activation_leases (
  user_id uuid primary key references public.users(id) on delete cascade,
  operation_id uuid not null,
  requested_active boolean not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null check (status in ('started', 'auth_updated', 'completed', 'failed', 'uncertain')),
  last_error text
);

create or replace function public.acquire_account_activation_lease(
  p_user_id uuid, p_operation_id uuid, p_requested_active boolean, p_ttl_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_ts timestamptz := now();
  ttl integer := greatest(coalesce(p_ttl_seconds, 30), 5);
begin
  if p_user_id is null or p_operation_id is null then
    raise exception 'Account activation lease requires a user and operation id' using errcode = '22023';
  end if;

  delete from public.account_activation_leases
  where user_id = p_user_id and expires_at <= now_ts;

  insert into public.account_activation_leases (user_id, operation_id, requested_active, started_at, expires_at, status)
  values (p_user_id, p_operation_id, p_requested_active, now_ts, now_ts + make_interval(secs => ttl), 'started')
  on conflict (user_id) do nothing;

  return exists (
    select 1 from public.account_activation_leases
    where user_id = p_user_id and operation_id = p_operation_id
  );
end;
$$;

create or replace function public.release_account_activation_lease(
  p_user_id uuid, p_operation_id uuid, p_status text, p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('completed', 'failed', 'uncertain') then
    raise exception 'Invalid lease release status' using errcode = '22023';
  end if;
  update public.account_activation_leases
  set status = p_status, last_error = p_error
  where user_id = p_user_id and operation_id = p_operation_id;
  delete from public.account_activation_leases
  where user_id = p_user_id and operation_id = p_operation_id
    and status in ('completed', 'failed');
end;
$$;

revoke all on table public.account_activation_leases from public, anon, authenticated;
grant select, insert, update, delete on public.account_activation_leases to service_role;
revoke all on function public.acquire_account_activation_lease(uuid,uuid,boolean,integer) from public, anon, authenticated;
grant execute on function public.acquire_account_activation_lease(uuid,uuid,boolean,integer) to service_role;
revoke all on function public.release_account_activation_lease(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.release_account_activation_lease(uuid,uuid,text,text) to service_role;

commit;
