begin;

insert into public.permissions (code, name, module, description) values
  ('events.view', 'View events and registrations', 'events', 'View event details and protected registration records.'),
  ('events.manage', 'Manage events', 'events', 'Create, publish, complete, cancel, and archive events.'),
  ('events.registration', 'Manage event registrations', 'events', 'Add, cancel, check in, and undo check-in for event registrants.')
on conflict (code) do update set name=excluded.name,module=excluded.module,description=excluded.description,updated_at=now();

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id from public.roles role
join public.permissions permission on permission.code in ('events.view','events.manage','events.registration')
where role.code='administrator'
on conflict (role_id,permission_id) do nothing;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  event_date date not null,
  starts_at time not null,
  ends_at time,
  location text not null,
  capacity integer,
  registration_enabled boolean not null default true,
  registration_open_at timestamptz,
  registration_close_at timestamptz,
  status text not null default 'draft',
  contact_person_member_id uuid references public.members(id) on delete set null,
  notes text,
  banner_url text,
  created_by uuid references public.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references public.users(id) on delete set null,
  constraint events_name_not_blank check (btrim(name)<>''),
  constraint events_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint events_location_not_blank check (btrim(location)<>''),
  constraint events_capacity_check check (capacity is null or capacity>0),
  constraint events_status_check check (status in ('draft','published','completed','cancelled','archived')),
  constraint events_time_order_check check (ends_at is null or ends_at>starts_at),
  constraint events_registration_window_check check (registration_close_at is null or registration_open_at is null or registration_close_at>registration_open_at)
);

create index if not exists events_date_idx on public.events(event_date,status);
create index if not exists events_archived_idx on public.events(archived_at,event_date);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  member_id uuid references public.members(id) on delete set null,
  first_name text not null,
  last_name text not null,
  mobile text,
  email text,
  gender text,
  age integer,
  notes text,
  status text not null default 'registered',
  registered_at timestamptz not null default now(),
  checked_in_at timestamptz,
  checked_in_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_registrations_first_name_not_blank check (btrim(first_name)<>''),
  constraint event_registrations_last_name_not_blank check (btrim(last_name)<>''),
  constraint event_registrations_status_check check (status in ('registered','cancelled')),
  constraint event_registrations_gender_check check (gender is null or gender in ('Male','Female')),
  constraint event_registrations_age_check check (age is null or age between 0 and 120),
  constraint event_registrations_checkin_check check (status='registered' or checked_in_at is null)
);

create unique index if not exists event_registrations_active_member_unique on public.event_registrations(event_id,member_id) where member_id is not null and status='registered';
create unique index if not exists event_registrations_active_email_unique on public.event_registrations(event_id,lower(btrim(email))) where email is not null and btrim(email)<>'' and status='registered';
create unique index if not exists event_registrations_active_mobile_unique on public.event_registrations(event_id,regexp_replace(mobile,'[^0-9]','','g')) where mobile is not null and btrim(mobile)<>'' and status='registered';
create index if not exists event_registrations_event_idx on public.event_registrations(event_id,status,registered_at);

create or replace function public.touch_event_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now();return new;end; $$;
drop trigger if exists events_touch_updated_at on public.events;
create trigger events_touch_updated_at before update on public.events for each row execute function public.touch_event_updated_at();
drop trigger if exists event_registrations_touch_updated_at on public.event_registrations;
create trigger event_registrations_touch_updated_at before update on public.event_registrations for each row execute function public.touch_event_updated_at();

alter table public.events enable row level security;
alter table public.event_registrations enable row level security;
revoke all on public.events,public.event_registrations from anon;
grant select,insert,update on public.events,public.event_registrations to authenticated;
drop policy if exists "Events admin view" on public.events;
create policy "Events admin view" on public.events for select to authenticated using(public.has_permission('events.view'));
drop policy if exists "Events admin manage" on public.events;
create policy "Events admin manage" on public.events for all to authenticated using(public.has_permission('events.manage')) with check(public.has_permission('events.manage'));
drop policy if exists "Event registrations admin view" on public.event_registrations;
create policy "Event registrations admin view" on public.event_registrations for select to authenticated using(public.has_permission('events.view'));
drop policy if exists "Event registrations admin manage" on public.event_registrations;
create policy "Event registrations admin manage" on public.event_registrations for all to authenticated using(public.has_permission('events.registration')) with check(public.has_permission('events.registration'));

create or replace function public.get_public_event(p_slug text)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'id',event.id,'name',event.name,'slug',event.slug,'description',event.description,
    'event_date',event.event_date,'starts_at',event.starts_at,'ends_at',event.ends_at,
    'location',event.location,'capacity',event.capacity,'registration_enabled',event.registration_enabled,
    'registration_open_at',event.registration_open_at,'registration_close_at',event.registration_close_at,
    'status',event.status,'banner_url',event.banner_url,
    'registered_count',(select count(*) from public.event_registrations registration where registration.event_id=event.id and registration.status='registered')
  ) from public.events event
  where event.slug=p_slug and event.status in ('published','completed','cancelled') and event.archived_at is null;
$$;

create or replace function public.register_for_event(
  p_event_slug text,p_first_name text,p_last_name text,p_mobile text default null,p_email text default null,
  p_gender text default null,p_age integer default null,p_notes text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.events%rowtype; registration_id uuid; matched_member_id uuid; active_count integer; admin_registration boolean:=public.has_permission('events.registration');
  normalized_email text:=lower(nullif(btrim(p_email),'')); normalized_mobile text:=nullif(regexp_replace(coalesce(p_mobile,''),'[^0-9]','','g'),'');
begin
  if btrim(coalesce(p_first_name,''))='' or btrim(coalesce(p_last_name,''))='' then raise exception 'First name and last name are required' using errcode='P0001'; end if;
  if p_gender is not null and p_gender not in ('Male','Female') then raise exception 'Invalid gender' using errcode='P0001'; end if;
  if p_age is not null and (p_age<0 or p_age>120) then raise exception 'Invalid age' using errcode='P0001'; end if;
  select * into target from public.events where slug=p_event_slug for update;
  if not found or target.archived_at is not null or (admin_registration and target.status not in ('draft','published')) or (not admin_registration and target.status<>'published') then raise exception 'This event is not available for registration' using errcode='P0001'; end if;
  if not admin_registration and not target.registration_enabled then raise exception 'Registration is disabled for this event' using errcode='P0001'; end if;
  if not admin_registration and target.registration_open_at is not null and now()<target.registration_open_at then raise exception 'Registration is not open yet' using errcode='P0001'; end if;
  if not admin_registration and target.registration_close_at is not null and now()>target.registration_close_at then raise exception 'Registration is closed' using errcode='P0001'; end if;
  select count(*) into active_count from public.event_registrations where event_id=target.id and status='registered';
  if target.capacity is not null and active_count>=target.capacity then raise exception 'Registration is full' using errcode='P0001'; end if;
  select candidate.id into matched_member_id from public.members candidate
  where (normalized_email is not null and lower(btrim(candidate.email))=normalized_email)
     or (normalized_mobile is not null and regexp_replace(coalesce(candidate.mobile,''),'[^0-9]','','g')=normalized_mobile)
  order by candidate.id limit 1;
  if (select count(distinct candidate.id) from public.members candidate where (normalized_email is not null and lower(btrim(candidate.email))=normalized_email) or (normalized_mobile is not null and regexp_replace(coalesce(candidate.mobile,''),'[^0-9]','','g')=normalized_mobile))<>1 then matched_member_id:=null; end if;
  if exists(select 1 from public.event_registrations registration where registration.event_id=target.id and registration.status='registered' and ((matched_member_id is not null and registration.member_id=matched_member_id) or (normalized_email is not null and lower(btrim(registration.email))=normalized_email) or (normalized_mobile is not null and regexp_replace(coalesce(registration.mobile,''),'[^0-9]','','g')=normalized_mobile))) then raise exception 'A registration already exists for this person' using errcode='23505'; end if;
  insert into public.event_registrations(event_id,member_id,first_name,last_name,mobile,email,gender,age,notes)
  values(target.id,matched_member_id,btrim(p_first_name),btrim(p_last_name),nullif(btrim(p_mobile),''),normalized_email,p_gender,p_age,nullif(btrim(p_notes),'')) returning id into registration_id;
  return jsonb_build_object('registration_id',registration_id,'event_name',target.name,'event_date',target.event_date,'starts_at',target.starts_at,'location',target.location,'registrant_name',btrim(p_first_name)||' '||btrim(p_last_name));
end; $$;

revoke all on function public.get_public_event(text) from public;
revoke all on function public.register_for_event(text,text,text,text,text,text,integer,text) from public;
grant execute on function public.get_public_event(text) to anon,authenticated;
grant execute on function public.register_for_event(text,text,text,text,text,text,integer,text) to anon,authenticated;

commit;
