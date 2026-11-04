begin;

-- Cross-instance serialization and recovery state for account activation.
--
-- This table is a lease/state store, not an audit log. Terminal rows
-- ('completed' / 'failed') are removed when released. Rows that could not be
-- verified are preserved with status 'uncertain' until an administrator
-- reconciles them.
--
-- operation_id always identifies the original activation operation.
-- reconciliation_id identifies the administrator reconciliation that currently
-- owns an unresolved row. The two are deliberately separate so a delayed
-- activation operation can never be mistaken for the reconciler.

create table if not exists public.account_activation_leases (
  user_id uuid primary key references public.users(id) on delete cascade,
  operation_id uuid not null,
  requested_active boolean not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null check (status in ('started', 'auth_updated', 'completed', 'failed', 'uncertain')),
  source text not null default 'activation' check (source in ('activation', 'reconciliation')),
  reconciliation_id uuid,
  reconciliation_started_at timestamptz,
  last_error text
);

comment on table public.account_activation_leases is
  'Per-user account activation lease. Terminal rows are deleted; uncertain rows require administrator reconciliation.';

-- Defensive forward compatibility for environments where an earlier revision of
-- this pending migration was applied locally.
alter table public.account_activation_leases
  add column if not exists source text not null default 'activation';
alter table public.account_activation_leases
  add column if not exists reconciliation_id uuid;
alter table public.account_activation_leases
  add column if not exists reconciliation_started_at timestamptz;

-- Acquire a fresh activation lease. An existing lease of any kind blocks the
-- acquisition: expired unresolved operations must be reconciled, never silently
-- replaced by a new activation.
create or replace function public.acquire_account_activation_lease(
  p_user_id uuid, p_operation_id uuid, p_requested_active boolean, p_ttl_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_ttl integer := greatest(coalesce(p_ttl_seconds, 30), 5);
begin
  if p_user_id is null or p_operation_id is null then
    raise exception 'Account activation lease requires a user and operation id' using errcode = '22023';
  end if;

  -- Remove only terminal rows that somehow survived their release. Uncertain,
  -- expired, or reconciliation-owned rows are never removed automatically.
  delete from public.account_activation_leases
  where user_id = p_user_id
    and status in ('completed', 'failed')
    and reconciliation_id is null;

  insert into public.account_activation_leases
    (user_id, operation_id, requested_active, started_at, expires_at, status, source)
  values
    (p_user_id, p_operation_id, p_requested_active, v_now, v_now + make_interval(secs => v_ttl), 'started', 'activation')
  on conflict (user_id) do nothing;

  return exists (
    select 1 from public.account_activation_leases
    where user_id = p_user_id
      and operation_id = p_operation_id
      and status in ('started', 'auth_updated')
      and expires_at > v_now
      and reconciliation_id is null
  );
end;
$$;

-- Renew only a live activation lease. A reconciliation claim, an expired lease,
-- or a terminal lease cannot be renewed by the original operation.
create or replace function public.renew_account_activation_lease(
  p_user_id uuid, p_operation_id uuid, p_ttl_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ttl integer := greatest(coalesce(p_ttl_seconds, 30), 5);
begin
  if p_user_id is null or p_operation_id is null then
    raise exception 'Account activation lease renewal requires a user and operation id' using errcode = '22023';
  end if;

  update public.account_activation_leases
  set expires_at = now() + make_interval(secs => v_ttl)
  where user_id = p_user_id
    and operation_id = p_operation_id
    and status in ('started', 'auth_updated')
    and expires_at > now()
    and reconciliation_id is null;

  return found;
end;
$$;

-- Release the original activation lease. A delayed operation cannot release or
-- overwrite a row that reconciliation has already claimed, and it cannot report
-- 'completed' / 'failed' after its lease has expired. 'uncertain' is always
-- preserved for reconciliation.
create or replace function public.release_account_activation_lease(
  p_user_id uuid, p_operation_id uuid, p_status text, p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('completed', 'failed', 'uncertain') then
    raise exception 'Invalid lease release status' using errcode = '22023';
  end if;

  if p_status = 'uncertain' then
    update public.account_activation_leases
    set status = 'uncertain', last_error = p_error
    where user_id = p_user_id
      and operation_id = p_operation_id
      and status in ('started', 'auth_updated')
      and reconciliation_id is null;
    return found;
  end if;

  update public.account_activation_leases
  set status = p_status, last_error = p_error
  where user_id = p_user_id
    and operation_id = p_operation_id
    and status in ('started', 'auth_updated')
    and expires_at > now()
    and reconciliation_id is null;

  if not found then
    return false;
  end if;

  delete from public.account_activation_leases
  where user_id = p_user_id
    and operation_id = p_operation_id
    and status in ('completed', 'failed');

  return true;
end;
$$;

-- Fencing helper: confirms the original operation still owns the live lease.
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
      and reconciliation_id is null
  );
$$;

-- Atomically claim an unresolved operation for administrator reconciliation.
--
-- A live activation (status started/auth_updated and not yet expired) is never
-- claimed. An expired activation or an existing uncertain row is claimed by
-- recording a distinct reconciliation_id and reconciliation_started_at. The
-- claim window prevents two reconciliations from working on the same row.
-- Repeated calls with the same reconciliation_id are idempotent.
create or replace function public.claim_account_activation_reconciliation(
  p_user_id uuid,
  p_reconciliation_id uuid,
  p_requested_active boolean default false,
  p_claim_ttl_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lease public.account_activation_leases%rowtype;
  v_attempt integer := 0;
  v_ttl integer := greatest(coalesce(p_claim_ttl_seconds, 300), 30);
  v_claim_window interval := make_interval(secs => greatest(coalesce(p_claim_ttl_seconds, 300), 30));
begin
  if p_user_id is null or p_reconciliation_id is null then
    raise exception 'Account activation reconciliation requires a user and reconciliation id' using errcode = '22023';
  end if;

  -- Loop handles the narrow race where another session inserts and then resolves
  -- the row between our SELECT ... FOR UPDATE and INSERT ... ON CONFLICT.
  loop
    v_attempt := v_attempt + 1;
    select * into v_lease
    from public.account_activation_leases
    where user_id = p_user_id
    for update;
    exit when found;

    if v_attempt >= 5 then
      raise exception 'Unable to claim account activation reconciliation lease' using errcode = '40001';
    end if;

    insert into public.account_activation_leases
      (user_id, operation_id, requested_active, started_at, expires_at, status, source,
       reconciliation_id, reconciliation_started_at)
    values
      (p_user_id, p_reconciliation_id, coalesce(p_requested_active, false), now(),
       now() + make_interval(secs => v_ttl), 'uncertain', 'reconciliation',
       p_reconciliation_id, now())
    on conflict (user_id) do nothing;
  end loop;

  -- A live operation owns the account. Do not read, repair, or release anything.
  if v_lease.status in ('started', 'auth_updated')
     and v_lease.expires_at > now()
     and v_lease.reconciliation_id is null then
    return jsonb_build_object(
      'claimed', false,
      'reason', 'live_operation',
      'lease_state', 'live',
      'synthetic', false,
      'lease', to_jsonb(v_lease)
    );
  end if;

  -- Another reconciliation still owns its claim window.
  if v_lease.status = 'uncertain'
     and v_lease.reconciliation_id is not null
     and v_lease.reconciliation_id <> p_reconciliation_id
     and v_lease.reconciliation_started_at is not null
     and v_lease.reconciliation_started_at > now() - v_claim_window then
    return jsonb_build_object(
      'claimed', false,
      'reason', 'reconciliation_in_progress',
      'lease_state', 'uncertain',
      'synthetic', false,
      'lease', to_jsonb(v_lease)
    );
  end if;

  -- Terminal rows should normally have been deleted. Resolve them into a fresh
  -- synthetic claim instead of treating them as an active operation.
  if v_lease.status in ('completed', 'failed') then
    delete from public.account_activation_leases where user_id = p_user_id;
    insert into public.account_activation_leases
      (user_id, operation_id, requested_active, started_at, expires_at, status, source,
       reconciliation_id, reconciliation_started_at)
    values
      (p_user_id, p_reconciliation_id, coalesce(p_requested_active, false), now(),
       now() + make_interval(secs => v_ttl), 'uncertain', 'reconciliation',
       p_reconciliation_id, now())
    on conflict (user_id) do nothing;

    select * into v_lease
    from public.account_activation_leases
    where user_id = p_user_id
    for update;

    return jsonb_build_object(
      'claimed', true,
      'reason', null,
      'lease_state', 'missing',
      'synthetic', true,
      'lease', to_jsonb(v_lease)
    );
  end if;

  -- Claim an expired activation or an existing uncertain row.
  update public.account_activation_leases
  set status = 'uncertain',
      reconciliation_id = p_reconciliation_id,
      reconciliation_started_at = now(),
      expires_at = now() + make_interval(secs => v_ttl),
      last_error = coalesce(last_error, 'Reconciliation claimed an unresolved activation lease.')
  where user_id = p_user_id;

  select * into v_lease
  from public.account_activation_leases
  where user_id = p_user_id
  for update;

  return jsonb_build_object(
    'claimed', true,
    'reason', null,
    'lease_state', 'uncertain',
    'synthetic', (v_lease.source = 'reconciliation' and v_lease.operation_id = p_reconciliation_id),
    'lease', to_jsonb(v_lease)
  );
end;
$$;

-- Finalize a reconciliation claim. The row is locked for the whole operation.
--
--   p_verified = false  -> keep the uncertain row, clear the reconciliation claim,
--                          and record the diagnostic so a later retry can claim it.
--   p_verified = true   -> re-check the persisted CMS active state inside the same
--                          transaction, then delete the resolved lease.
--
-- Deleting an already-resolved row is reported as already_finalized so repeated
-- reconciliation requests are idempotent.
create or replace function public.finalize_account_activation_reconciliation(
  p_user_id uuid,
  p_reconciliation_id uuid,
  p_verified boolean,
  p_expected_active boolean default null,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lease public.account_activation_leases%rowtype;
  v_active boolean;
begin
  if p_user_id is null or p_reconciliation_id is null or p_verified is null then
    raise exception 'Account activation reconciliation finalization requires a user, reconciliation id, and verdict' using errcode = '22023';
  end if;

  select * into v_lease
  from public.account_activation_leases
  where user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object(
      'verified', p_verified,
      'released', true,
      'already_finalized', true,
      'reason', null
    );
  end if;

  if v_lease.reconciliation_id is distinct from p_reconciliation_id then
    return jsonb_build_object(
      'verified', false,
      'released', false,
      'already_finalized', false,
      'reason', 'stale_reconciler'
    );
  end if;

  if v_lease.status <> 'uncertain' then
    return jsonb_build_object(
      'verified', false,
      'released', false,
      'already_finalized', false,
      'reason', 'lease_state_changed'
    );
  end if;

  if p_verified is not true then
    update public.account_activation_leases
    set reconciliation_id = null,
        reconciliation_started_at = null,
        last_error = coalesce(p_message, 'Reconciliation could not verify the final state.')
    where user_id = p_user_id
      and reconciliation_id = p_reconciliation_id;
    return jsonb_build_object(
      'verified', false,
      'released', false,
      'already_finalized', false,
      'reason', 'not_verified'
    );
  end if;

  -- Verify the CMS state did not change between the Edge Function's read and
  -- this transaction. The Auth state was verified by the caller.
  if p_expected_active is not null then
    select is_active into v_active from public.users where id = p_user_id;
    if not found or v_active is distinct from p_expected_active then
      update public.account_activation_leases
      set reconciliation_id = null,
          reconciliation_started_at = null,
          last_error = 'Final verification failed: CMS status changed during reconciliation.'
      where user_id = p_user_id
        and reconciliation_id = p_reconciliation_id;
      return jsonb_build_object(
        'verified', false,
        'released', false,
        'already_finalized', false,
        'reason', 'cms_state_changed'
      );
    end if;
  end if;

  delete from public.account_activation_leases
  where user_id = p_user_id
    and reconciliation_id = p_reconciliation_id;

  return jsonb_build_object(
    'verified', true,
    'released', true,
    'already_finalized', false,
    'reason', null
  );
end;
$$;

-- Fenced status transition.
--
-- Audit (repository, before this migration): the only caller is the
-- manage-cms-users Edge Function. No SQL function depends on the original
-- three-argument overload. Both obsolete overloads are dropped so there is no
-- unfenced path left behind.
drop function if exists public.admin_user_set_active(uuid, uuid, boolean);
drop function if exists public.admin_user_set_active(uuid, uuid, boolean, uuid);

create or replace function public.admin_user_set_active(
  p_auth_user_id uuid,
  p_caller_user_id uuid,
  p_is_active boolean,
  p_operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lease_owned boolean;
begin
  if p_operation_id is null then
    raise exception 'A fenced account activation operation id is required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.users u join public.user_roles ur on ur.user_id = u.id
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where u.id = p_caller_user_id and u.is_active and p.code = 'admin.users'
  ) then raise exception 'admin.users permission required' using errcode = '42501'; end if;

  perform pg_advisory_xact_lock(hashtext('ggccc-active-administrator'));

  -- Lock the lease row for the duration of this transaction. Acquisition,
  -- renewal, release, and reconciliation all update this row, so ownership
  -- cannot change between this validation and the users.is_active update.
  -- Only an unexpired, live, original operation may mutate CMS status.
  select true into v_lease_owned
  from public.account_activation_leases l
  where l.user_id = p_auth_user_id
    and l.operation_id = p_operation_id
    and l.status in ('started', 'auth_updated')
    and l.expires_at > now()
    and l.reconciliation_id is null
  for update;

  if v_lease_owned is not true then
    raise exception 'Account activation lease is missing, expired, uncertain, or owned by another operation'
      using errcode = '42501';
  end if;

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
revoke all on function public.claim_account_activation_reconciliation(uuid,uuid,boolean,integer) from public, anon, authenticated;
grant execute on function public.claim_account_activation_reconciliation(uuid,uuid,boolean,integer) to service_role;
revoke all on function public.finalize_account_activation_reconciliation(uuid,uuid,boolean,boolean,text) from public, anon, authenticated;
grant execute on function public.finalize_account_activation_reconciliation(uuid,uuid,boolean,boolean,text) to service_role;
revoke all on function public.admin_user_set_active(uuid,uuid,boolean,uuid) from public, anon, authenticated;
grant execute on function public.admin_user_set_active(uuid,uuid,boolean,uuid) to service_role;

commit;
