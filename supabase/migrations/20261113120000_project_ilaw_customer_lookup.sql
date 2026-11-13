-- Project Ilaw Phase 2 (follow-up): customer order lookup by name + mobile.
-- Adds a second, customer-facing lookup path that does not require the order
-- reference, plus a small rate-limit table. The reference-based lookup remains
-- available for payment submission and internal workflows.

begin;

-- Normalise a Philippine mobile number to its 11-digit 09XXXXXXXXX form.
-- Returns null when the input cannot be recognised as a Philippine number.
create or replace function public.normalize_project_ilaw_mobile(p_mobile text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_mobile, '') ~ '[A-Za-z]' then null
    when digits ~ '^09[0-9]{9}$' then digits
    when digits ~ '^639[0-9]{9}$' then '0' || substr(digits, 3)
    when digits ~ '^[0-9]{10}$' and digits like '9%' then '0' || digits
    else null
  end
  from (select regexp_replace(coalesce(p_mobile, ''), '[^0-9]', '', 'g') as digits) d;
$$;

-- Rate-limit bookkeeping for customer lookups. Only touched by the
-- security-definer lookup function; no direct access is granted.
create table if not exists public.project_ilaw_customer_lookup_attempts (
  id bigserial primary key,
  mobile_hash text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists project_ilaw_customer_lookup_attempts_mobile_hash_idx
  on public.project_ilaw_customer_lookup_attempts (mobile_hash, attempted_at);

alter table public.project_ilaw_customer_lookup_attempts enable row level security;
-- No policies: only the security-definer function reads/writes this table.

-- Customer-facing lookup by registered name + mobile number. Returns every
-- order matching both details (newest first) without exposing payment tokens.
-- Requires BOTH name and mobile; never matches on mobile alone.
create or replace function public.get_project_ilaw_payment_contexts_by_customer(
  p_name text,
  p_mobile text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  clean_name text := lower(trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')));
  norm_mobile text := public.normalize_project_ilaw_mobile(p_mobile);
  v_mobile_hash text := md5(coalesce(norm_mobile, ''));
  attempt_count integer;
  result jsonb;
begin
  if clean_name = '' or norm_mobile is null then
    raise exception 'Name and mobile number are required' using errcode = '22023';
  end if;

  -- Abuse protection: cap lookups per normalised mobile number.
  select count(*) into attempt_count
  from public.project_ilaw_customer_lookup_attempts
  where mobile_hash = v_mobile_hash
    and attempted_at > now() - interval '15 minutes';

  if attempt_count >= 10 then
    raise exception 'Too many lookup attempts. Please try again later.'
      using errcode = 'P0001';
  end if;

  insert into public.project_ilaw_customer_lookup_attempts (mobile_hash)
  values (v_mobile_hash);

  select coalesce(jsonb_agg(jsonb_build_object(
    'reference', o.reference,
    'customer_name', o.customer_name,
    'total_quantity', o.total_quantity,
    'total_amount', o.total_amount,
    'payment_status', o.payment_status,
    'fulfillment_status', o.fulfillment_status
  ) order by o.created_at desc), '[]'::jsonb)
  into result
  from public.project_ilaw_orders o
  where public.normalize_project_ilaw_mobile(o.mobile) = norm_mobile
    and lower(trim(regexp_replace(o.customer_name, '\s+', ' ', 'g'))) = clean_name;

  return result;
end;
$$;

revoke all on function public.get_project_ilaw_payment_contexts_by_customer(text, text) from public;
grant execute on function public.get_project_ilaw_payment_contexts_by_customer(text, text) to anon, authenticated;

revoke all on function public.normalize_project_ilaw_mobile(text) from public;
grant execute on function public.normalize_project_ilaw_mobile(text) to anon, authenticated;

commit;
