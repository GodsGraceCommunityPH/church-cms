begin;

insert into public.permissions (code, name, module, description) values
  ('evangelism.view', 'View evangelism contacts', 'evangelism', 'View people reached through evangelism and outreach.'),
  ('evangelism.manage', 'Manage evangelism contacts', 'evangelism', 'Create, update, and delete evangelism contact records.')
on conflict (code) do update set name=excluded.name, module=excluded.module, description=excluded.description, updated_at=now();

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code in ('evangelism.view','evangelism.manage')
where r.code='administrator' on conflict (role_id, permission_id) do nothing;

create or replace function public.normalize_ph_mobile(value text)
returns text language sql immutable set search_path='' as $$
  select case
    when regexp_replace(coalesce(value,''),'[^0-9]','','g') like '09%' and length(regexp_replace(value,'[^0-9]','','g'))=11
      then '63'||substring(regexp_replace(value,'[^0-9]','','g') from 2)
    when regexp_replace(coalesce(value,''),'[^0-9]','','g') like '639%' and length(regexp_replace(value,'[^0-9]','','g'))=12
      then regexp_replace(value,'[^0-9]','','g')
    else nullif(regexp_replace(coalesce(value,''),'[^0-9]','','g'),'') end
$$;

create table if not exists public.evangelism_contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  mobile text,
  normalized_mobile text generated always as (public.normalize_ph_mobile(mobile)) stored,
  address_area text,
  date_reached date not null default current_date,
  reached_by text,
  source text not null default 'personal_evangelism',
  source_other text,
  status text not null default 'new',
  notes text,
  member_id uuid references public.members(id) on delete set null,
  created_by uuid references public.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evangelism_first_name_not_blank check (btrim(first_name)<>''),
  constraint evangelism_last_name_not_blank check (btrim(last_name)<>''),
  constraint evangelism_source_check check (source in ('sunday_service','cell_outreach','personal_evangelism','event','referral','other')),
  constraint evangelism_source_other_check check (source<>'other' or nullif(btrim(source_other),'') is not null),
  constraint evangelism_status_check check (status in ('new','contacted','connected','converted_to_member'))
);

create index if not exists evangelism_contacts_name_idx on public.evangelism_contacts(lower(last_name),lower(first_name));
create index if not exists evangelism_contacts_mobile_idx on public.evangelism_contacts(normalized_mobile) where normalized_mobile is not null;
create index if not exists evangelism_contacts_date_idx on public.evangelism_contacts(date_reached desc);

create or replace function public.touch_evangelism_contact_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists evangelism_contacts_touch_updated_at on public.evangelism_contacts;
create trigger evangelism_contacts_touch_updated_at before update on public.evangelism_contacts for each row execute function public.touch_evangelism_contact_updated_at();

alter table public.evangelism_contacts enable row level security;
revoke all on public.evangelism_contacts from anon;
grant select, insert, update, delete on public.evangelism_contacts to authenticated;
create policy "Evangelism contacts view" on public.evangelism_contacts for select to authenticated using (public.has_permission('evangelism.view'));
create policy "Evangelism contacts manage" on public.evangelism_contacts for all to authenticated using (public.has_permission('evangelism.manage')) with check (public.has_permission('evangelism.manage'));
commit;
