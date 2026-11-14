-- Keep production stage quantities reconciled during every movement.
-- The previous implementation used two UPDATE statements, causing the
-- reconciliation CHECK constraint to reject the temporary intermediate row.

create or replace function public.move_project_ilaw_production(
  p_variant_id uuid,
  p_quantity integer,
  p_from text,
  p_to text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor uuid := auth.uid();
  clean_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  from_idx integer;
  to_idx integer;
  avail integer;
  is_backward boolean;
begin
  if not public.has_permission('project_ilaw.production.move') then
    raise exception 'project_ilaw.production.move permission required' using errcode = '42501';
  end if;
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_variant_id is null then
    raise exception 'Variant is required' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be positive' using errcode = '22023';
  end if;

  from_idx := public.project_ilaw_stage_index(p_from);
  to_idx := public.project_ilaw_stage_index(p_to);
  if from_idx is null or to_idx is null then
    raise exception 'Invalid stage' using errcode = '22023';
  end if;
  if abs(from_idx - to_idx) <> 1 then
    raise exception 'Only adjacent stage movements are allowed' using errcode = '22023';
  end if;

  is_backward := to_idx < from_idx;
  if is_backward and clean_reason is null then
    raise exception 'A reason is required for backward movements' using errcode = '22023';
  end if;
  if clean_reason is not null and char_length(clean_reason) > 500 then
    raise exception 'Reason must be at most 500 characters' using errcode = '22023';
  end if;

  select case p_from
    when 'pending' then pending_qty
    when 'processing' then processing_qty
    when 'manufacturing' then manufacturing_qty
    when 'completed' then completed_qty
  end into avail
  from public.project_ilaw_production_progress
  where variant_id = p_variant_id
  for update;

  if avail is null then
    raise exception 'Variant not found' using errcode = 'P0002';
  end if;
  if avail < p_quantity then
    raise exception 'Not enough units in the source stage' using errcode = 'P0001';
  end if;

  -- Update source and destination together so the CHECK constraint only
  -- evaluates the final balanced quantities.
  update public.project_ilaw_production_progress
  set pending_qty = pending_qty
        - case when p_from = 'pending' then p_quantity else 0 end
        + case when p_to = 'pending' then p_quantity else 0 end,
      processing_qty = processing_qty
        - case when p_from = 'processing' then p_quantity else 0 end
        + case when p_to = 'processing' then p_quantity else 0 end,
      manufacturing_qty = manufacturing_qty
        - case when p_from = 'manufacturing' then p_quantity else 0 end
        + case when p_to = 'manufacturing' then p_quantity else 0 end,
      completed_qty = completed_qty
        - case when p_from = 'completed' then p_quantity else 0 end
        + case when p_to = 'completed' then p_quantity else 0 end,
      updated_at = now()
  where variant_id = p_variant_id;

  insert into public.project_ilaw_production_movements
    (variant_id, quantity, from_stage, to_stage, movement_type, actor_id, note)
  values
    (p_variant_id, p_quantity, p_from, p_to,
     case when is_backward then 'backward' else 'forward' end,
     actor, clean_reason);

  return jsonb_build_object(
    'variant_id', p_variant_id,
    'quantity', p_quantity,
    'from', p_from,
    'to', p_to
  );
end;
$function$;
