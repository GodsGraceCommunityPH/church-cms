begin;

-- Slugs must be chosen before the Cell Group row is written, but the matching
-- reservation cannot reference that row until after it exists.
create or replace function public.assign_cell_group_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_slug text;
  candidate text;
  suffix integer := 1;
  reservation_owner uuid;
begin
  if tg_op = 'UPDATE'
     and new.name is not distinct from old.name
     and old.slug is not null then
    return new;
  end if;

  base_slug := public.slugify_cell_group_name(new.name);
  candidate := base_slug;

  -- Serialize competing names until the AFTER trigger records the reservation.
  perform pg_advisory_xact_lock(hashtextextended(base_slug, 0));

  loop
    select reservation.cell_group_id
    into reservation_owner
    from public.cell_group_slug_reservations reservation
    where reservation.slug = candidate;

    exit when reservation_owner is null or reservation_owner = new.id;

    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix;
    reservation_owner := null;
  end loop;

  new.slug := candidate;
  return new;
end;
$$;

create or replace function public.reserve_cell_group_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.cell_group_slug_reservations (slug, cell_group_id)
  values (new.slug, new.id)
  on conflict (slug) do nothing;

  if tg_op = 'UPDATE' and old.slug is not null and old.slug <> new.slug then
    insert into public.cell_group_slug_aliases (cell_group_id, slug)
    values (old.id, old.slug)
    on conflict (slug) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists assign_cell_group_slug_trigger on public.cell_groups;
create trigger assign_cell_group_slug_trigger
before insert or update of name on public.cell_groups
for each row execute function public.assign_cell_group_slug();

drop trigger if exists reserve_cell_group_slug_trigger on public.cell_groups;
create trigger reserve_cell_group_slug_trigger
after insert or update of name on public.cell_groups
for each row execute function public.reserve_cell_group_slug();

revoke all on function public.assign_cell_group_slug() from public, anon, authenticated;
revoke all on function public.reserve_cell_group_slug() from public, anon, authenticated;

commit;
