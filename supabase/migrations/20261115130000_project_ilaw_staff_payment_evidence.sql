-- Allow authorised Project Ilaw payment reviewers to attach evidence received
-- directly from a customer, without exposing the private evidence bucket.
create or replace function public.project_ilaw_can_upload_staff_payment_evidence(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts text[];
  target public.project_ilaw_orders%rowtype;
begin
  if auth.uid() is null
     or not public.has_permission('project_ilaw.orders.confirm_payment') then
    return false;
  end if;

  parts := string_to_array(coalesce(p_name, ''), '/');
  if array_length(parts, 1) is distinct from 3
     or parts[1] <> 'staff'
     or btrim(coalesce(parts[3], '')) = '' then
    return false;
  end if;

  begin
    select * into target
    from public.project_ilaw_orders
    where id = parts[2]::uuid;
  exception when others then
    return false;
  end;

  return found
    and target.payment_method = 'gcash'
    and target.payment_status <> 'paid'
    and target.fulfillment_status <> 'cancelled';
end;
$$;

drop policy if exists "Project Ilaw staff upload payment evidence"
  on storage.objects;
create policy "Project Ilaw staff upload payment evidence"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'project-ilaw-payment-evidence'
  and public.project_ilaw_can_upload_staff_payment_evidence(name)
);

create or replace function public.record_project_ilaw_staff_payment_evidence(
  p_order_id uuid,
  p_evidence_path text,
  p_payment_reference text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.project_ilaw_orders%rowtype;
  actor uuid := auth.uid();
  clean_reference text := nullif(btrim(coalesce(p_payment_reference, '')), '');
  clean_note text := nullif(btrim(coalesce(p_note, '')), '');
  previous_status text;
  previous_path text;
begin
  if actor is null
     or not public.has_permission('project_ilaw.orders.confirm_payment') then
    raise exception 'project_ilaw.orders.confirm_payment permission required'
      using errcode = '42501';
  end if;
  if p_order_id is null or p_evidence_path is null then
    raise exception 'Order and payment evidence are required' using errcode = '22023';
  end if;
  if clean_reference is not null and char_length(clean_reference) > 120 then
    raise exception 'Transaction reference must be at most 120 characters' using errcode = '22023';
  end if;
  if clean_note is not null and char_length(clean_note) > 1000 then
    raise exception 'Staff note must be at most 1000 characters' using errcode = '22023';
  end if;

  select * into target
  from public.project_ilaw_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if target.payment_method <> 'gcash'
     or target.payment_status = 'paid'
     or target.fulfillment_status = 'cancelled' then
    raise exception 'Payment evidence can only be attached to an unpaid, active GCash order'
      using errcode = 'P0001';
  end if;
  if p_evidence_path !~ ('^staff/' || p_order_id::text || '/[^/]+$') then
    raise exception 'Payment evidence path does not match this order' using errcode = '22023';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'project-ilaw-payment-evidence'
      and name = p_evidence_path
  ) then
    raise exception 'Uploaded payment evidence was not found' using errcode = 'P0002';
  end if;

  previous_status := target.payment_status;
  previous_path := target.payment_evidence_path;

  update public.project_ilaw_orders
  set payment_status = 'payment_verification',
      payment_reference = coalesce(clean_reference, payment_reference),
      payment_evidence_path = p_evidence_path,
      payment_submitted_at = now(),
      updated_at = now()
  where id = target.id
  returning * into target;

  insert into public.project_ilaw_order_events (
    order_id, event_type, actor_id, actor_type,
    previous_value, new_value, note
  ) values (
    target.id, 'payment_submitted', actor, 'user',
    jsonb_build_object(
      'payment_status', previous_status,
      'payment_evidence_path', previous_path
    ),
    jsonb_build_object(
      'payment_status', target.payment_status,
      'payment_reference', target.payment_reference,
      'payment_evidence_path', target.payment_evidence_path,
      'uploaded_by', actor
    ),
    coalesce(clean_note, 'Payment proof attached by staff after receiving it from the customer.')
  );

  return jsonb_build_object(
    'order_id', target.id,
    'payment_status', target.payment_status,
    'payment_reference', target.payment_reference,
    'payment_evidence_path', target.payment_evidence_path,
    'payment_submitted_at', target.payment_submitted_at
  );
end;
$$;

revoke all on function public.project_ilaw_can_upload_staff_payment_evidence(text)
  from public, anon;
grant execute on function public.project_ilaw_can_upload_staff_payment_evidence(text)
  to authenticated;

revoke all on function public.record_project_ilaw_staff_payment_evidence(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_project_ilaw_staff_payment_evidence(uuid, text, text, text)
  to authenticated;
