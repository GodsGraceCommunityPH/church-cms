begin;

create table public.cell_group_slug_reservations (
  slug text primary key,
  cell_group_id uuid not null references public.cell_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint cell_group_slug_reservations_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table public.cell_group_slug_aliases (
  id uuid primary key default gen_random_uuid(),
  cell_group_id uuid not null references public.cell_groups(id) on delete cascade,
  slug text not null unique references public.cell_group_slug_reservations(slug) on delete cascade,
  created_at timestamptz not null default now(),
  unique (cell_group_id, slug)
);

alter table public.cell_groups add column slug text;

create or replace function public.slugify_cell_group_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(trim(both '-' from regexp_replace(
      regexp_replace(
        regexp_replace(
          translate(lower(btrim(coalesce(p_name, ''))),
            'áàâäãåæçéèêëíìîïñóòôöõøœúùûüýÿ',
            'aaaaaaaceeeeiiiinooooooouuuuyy'),
          '[''’]', '', 'g'),
        '[^a-z0-9]+', '-', 'g'),
      '-+', '-', 'g'
    )), ''),
    'cell-group'
  );
$$;

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
begin
  if tg_op = 'UPDATE'
     and new.name is not distinct from old.name
     and old.slug is not null then
    return new;
  end if;

  base_slug := public.slugify_cell_group_name(new.name);
  candidate := base_slug;

  loop
    insert into public.cell_group_slug_reservations (slug, cell_group_id)
    values (candidate, new.id)
    on conflict (slug) do nothing;

    if found then
      exit;
    end if;

    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix;
  end loop;

  if tg_op = 'UPDATE' and old.slug is not null and old.slug <> candidate then
    insert into public.cell_group_slug_aliases (cell_group_id, slug)
    values (old.id, old.slug)
    on conflict (slug) do nothing;
  end if;

  new.slug := candidate;
  return new;
end;
$$;

create trigger assign_cell_group_slug_trigger
before insert or update of name on public.cell_groups
for each row execute function public.assign_cell_group_slug();

-- Backfill is deterministic by creation time and UUID; existing relationships
-- remain untouched because only the new slug column is updated.
do $$
declare
  target record;
begin
  for target in
    select id from public.cell_groups where slug is null order by created_at, id
  loop
    update public.cell_groups set name = name where id = target.id;
  end loop;
end;
$$;

alter table public.cell_groups alter column slug set not null;
alter table public.cell_groups
  add constraint cell_groups_slug_unique unique (slug),
  add constraint cell_groups_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

create index cell_group_slug_aliases_cell_group_id_idx
on public.cell_group_slug_aliases(cell_group_id);

alter table public.cell_group_slug_reservations enable row level security;
alter table public.cell_group_slug_aliases enable row level security;
revoke all on public.cell_group_slug_reservations from public, anon, authenticated;
revoke all on public.cell_group_slug_aliases from public, anon, authenticated;

create or replace function public.resolve_cell_group_registration_identifier(p_identifier text)
returns table (
  cell_group_id uuid,
  group_name text,
  current_slug text,
  is_canonical boolean,
  registration_token text
)
language sql
stable
security definer
set search_path = ''
as $$
  select resolved.cell_group_id, cell_group.name, cell_group.slug,
    p_identifier = cell_group.slug, active_invite.token
  from (
    select current_group.id as cell_group_id, 1 as priority
    from public.cell_groups current_group
    where current_group.slug = p_identifier
    union all
    select alias.cell_group_id, 2
    from public.cell_group_slug_aliases alias
    where alias.slug = p_identifier
    union all
    select invite.cell_group_id, 3
    from public.cell_group_invites invite
    where invite.token = p_identifier and invite.is_active = true
  ) resolved
  join public.cell_groups cell_group on cell_group.id = resolved.cell_group_id
  join lateral (
    select invite.token
    from public.cell_group_invites invite
    where invite.cell_group_id = resolved.cell_group_id and invite.is_active = true
    order by invite.token
    limit 1
  ) active_invite on true
  order by resolved.priority
  limit 1;
$$;

revoke all on function public.slugify_cell_group_name(text) from public, anon, authenticated;
revoke all on function public.assign_cell_group_slug() from public, anon, authenticated;
revoke all on function public.resolve_cell_group_registration_identifier(text) from public, anon, authenticated;
grant execute on function public.resolve_cell_group_registration_identifier(text) to anon, authenticated;

commit;
