begin;

do $$
declare
  first_group public.cell_groups%rowtype;
  second_group public.cell_groups%rowtype;
begin
  insert into public.cell_groups (name, status)
  values ('Slug Trigger Verification Bamboo', 'Active')
  returning * into first_group;

  if first_group.slug <> 'slug-trigger-verification-bamboo' then
    raise exception 'Unexpected initial slug: %', first_group.slug;
  end if;

  if not exists (
    select 1 from public.cell_group_slug_reservations
    where slug = first_group.slug and cell_group_id = first_group.id
  ) then
    raise exception 'New Cell Group slug was not reserved';
  end if;

  update public.cell_groups
  set name = 'Slug Trigger Verification Kawayan'
  where id = first_group.id
  returning * into first_group;

  if not exists (
    select 1 from public.cell_group_slug_aliases
    where slug = 'slug-trigger-verification-bamboo'
      and cell_group_id = first_group.id
  ) then
    raise exception 'Renamed Cell Group alias was not preserved';
  end if;

  insert into public.cell_groups (name, status)
  values ('Slug Trigger Verification Bamboo', 'Active')
  returning * into second_group;

  if second_group.slug <> 'slug-trigger-verification-bamboo-2' then
    raise exception 'Reserved slug was unexpectedly reused: %', second_group.slug;
  end if;
end;
$$;

rollback;
