begin;

-- Cross-instance serialization for account activation.
-- This table is a lease/state store, not an audit log. Rows with status
-- 'completed' or 'failed' are removed when released. Rows with status
-- 'uncertain' are preserved until an administrator reconciles them.

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

  -- Only fully resolved operations may be replaced automatically.
  delete from public.account_activation_leases
  where user_id = p_user_id
    and expires_at <= now_ts
    and status in ('completed', 'failed');

  insert into public.account_activation_leases (user_id, operation_id, requested_active, started_at, expires_at, status)
  values (p_user_id, p_operation_id, p_requested_active, now_ts, now_ts + make_interval(secs => ttl), 'started')
  on conflict (user_id) do nothing;

  return exists (
    select 1 from public.account_activation_leases
    where user_id = p_user_id and operation_id = p_operation_id
  );
end;
$$;

create or replace function public.renew_account_activation_lease(
  p_user_id uuid, p_operation_id uuid, p_ttl_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  ttl integer := greatest(coalesce(p_ttl_seconds, 30), 5);
begin
  if p_user_id is null or p_operation_id is null then
    raise exception 'Account activation lease renewal requires a user and operation id' using errcode = '22023';
  end if;

  update public.account_activation_leases
  set expires_at = now() + make_interval(secs => ttl)
  where user_id = p_user_id
    and operation_id = p_operation_id
    and status in ('started', 'auth_updated')
    and expires_at > now();

  return found;
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
  -- Preserve uncertain records for reconciliation; remove resolved ones.
  delete from public.account_activation_leases
  where user_id = p_user_id and operation_id = p_operation_id
    and status in ('completed', 'failed');
end;
$$;

-- Fencing helper: confirms the operation still owns the active lease.
create or replace function public.account_activation_lease_owner(
  p_user_id uuid, p_operation_id uuid
)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.account_activation_leases
    where user_id = p_user_id and operation_id = p_operation_id
      and status in ('started', 'auth_updated')
      and expires_at > now()
  );
$$;

-- Fenced status transition: admin_user_set_active now requires the operation
-- ID of the lease holder. The check runs inside the same transaction that
-- updates users.is_active, so a stale or expired operation cannot mutate CMS
-- state even if it still holds a network connection.
create or replace function public.admin_user_set_active(
  p_auth_user_id uuid, p_caller_user_id uuid, p_is_active boolean,
  p_operation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.users u join public.user_roles ur on ur.user_id = u.id
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where u.id = p_caller_user_id and u.is_active and p.code = 'admin.users'
  ) then raise exception 'admin.users permission required' using errcode = '42501'; end if;

  if p_operation_id is not null then
    if not exists (
      select 1 from public.account_activation_leases l
      where l.user_id = p_auth_user_id and l.operation_id = p_operation_id
        and l.status in ('started', 'auth_updated')
        and l.expires_at > now()
    ) then
      raise exception 'Account activation lease is missing, expired, or owned by another operation'
        using errcode = '42501';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('ggccc-active-administrator'));
  if p_auth_user_id = p_caller_user_id and not p_is_active then
    raise exception 'You cannot deactivate your own account' using errcode = '42501';
  end if;
  if not p_is_active and exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = p_auth_user_id and r.code = 'administrator'
  ) and (
    select count(*) from public.users u join public.user_roles ur on ur.user_id = u.id
    join public.roles r on r.id = ur.role_id
    where u.is_active and r.code = 'administrator'
  ) <= 1 then
    raise exception 'At least one active Administrator must remain' using errcode = '23514';
  end if;

  update public.users set is_active = p_is_active, updated_at = now()
  where id = p_auth_user_id;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;

  return jsonb_build_object('verified', true, 'operation_id', p_operation_id);
end;
$$;

revoke all on table public.account_activation_leases from public, anon, authenticated;
grant select, insert, update, delete on public.account_activation_leases to service_role;
revoke all on function public.acquire_account_activation_lease(uuid,uuid,boolean,integer) from public, anon, authenticated;
grant execute on function public.acquire_account_activation_lease(uuid,uuid,boolean,integer) to service_role;
revoke all on function public.renew_account_activation_lease(uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.renew_account_activation_lease(uuid,uuid,integer) to service_role;
revoke all on function public.release_account_activation_lease(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.release_account_activation_lease(uuid,uuid,text,text) to service_role;
revoke all on function public.account_activation_lease_owner(uuid,uuid) from public, anon, authenticated;
grant execute on function public.account_activation_lease_owner(uuid,uuid) to service_role;
revoke all on function public.admin_user_set_active(uuid,uuid,boolean,uuid) from public, anon, authenticated;
grant execute on function public.admin_user_set_active(uuid,uuid,boolean,uuid) to service_role;

commit;
