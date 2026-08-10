select count(*) as groups_without_slugs from public.cell_groups where slug is null;

select slug, count(*) as reservation_count
from public.cell_group_slug_reservations
group by slug having count(*) > 1;

select cell_group.id, cell_group.name, cell_group.slug,
  resolver.cell_group_id as resolved_cell_group_id,
  resolver.current_slug
from public.cell_groups cell_group
left join lateral public.resolve_cell_group_registration_identifier(cell_group.slug) resolver on true
order by cell_group.created_at, cell_group.id;

select alias.slug, alias.cell_group_id, cell_group.slug as current_slug
from public.cell_group_slug_aliases alias
join public.cell_groups cell_group on cell_group.id = alias.cell_group_id
order by alias.created_at;

begin;

do $$
declare
  first_group public.cell_groups%rowtype;
  second_group public.cell_groups%rowtype;
begin
  insert into public.cell_groups (name, status)
  values ('Friendly URL Verification Bamboo', 'Active')
  returning * into first_group;

  if first_group.slug <> 'friendly-url-verification-bamboo' then
    raise exception 'Unexpected initial slug: %', first_group.slug;
  end if;

  update public.cell_groups set name = 'Friendly URL Verification Kawayan'
  where id = first_group.id returning * into first_group;
  update public.cell_groups set name = 'Friendly URL Verification Kawayan North'
  where id = first_group.id returning * into first_group;

  if not exists (
    select 1 from public.cell_group_slug_aliases
    where cell_group_id = first_group.id and slug = 'friendly-url-verification-bamboo'
  ) or not exists (
    select 1 from public.cell_group_slug_aliases
    where cell_group_id = first_group.id and slug = 'friendly-url-verification-kawayan'
  ) then
    raise exception 'Multiple rename aliases were not preserved';
  end if;

  insert into public.cell_groups (name, status)
  values ('Friendly URL Verification Bamboo', 'Active')
  returning * into second_group;

  if second_group.slug <> 'friendly-url-verification-bamboo-2' then
    raise exception 'Historical alias was not reserved: %', second_group.slug;
  end if;
end;
$$;

rollback;
