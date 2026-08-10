begin;

insert into public.permissions (code, name, module, description) values
  ('website_content.view', 'View website content', 'website_content', 'View website content administration.'),
  ('website_content.manage', 'Manage website content', 'website_content', 'Create, edit, publish, hide, and archive website content.')
on conflict (code) do update set name=excluded.name,module=excluded.module,description=excluded.description;

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id from public.roles role cross join public.permissions permission
where role.code='administrator' and permission.code in ('website_content.view','website_content.manage')
on conflict do nothing;

create table if not exists public.worship_messages (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Sunday Worship Message',
  worship_date date not null,
  video_url text not null unique,
  thumbnail_path text,
  description text,
  status text not null default 'published' check (status in ('published','hidden')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint worship_messages_title_not_blank check (btrim(title)<>''),
  constraint worship_messages_video_url_http check (video_url ~* '^https?://')
);

create index if not exists worship_messages_public_order_idx on public.worship_messages(worship_date desc) where status='published' and archived_at is null;

create or replace function public.touch_worship_message_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists worship_messages_touch_updated_at on public.worship_messages;
create trigger worship_messages_touch_updated_at before update on public.worship_messages for each row execute function public.touch_worship_message_updated_at();

alter table public.worship_messages enable row level security;
revoke all on public.worship_messages from public,anon,authenticated;
grant select on public.worship_messages to anon,authenticated;
grant insert,update on public.worship_messages to authenticated;

drop policy if exists "Public reads published worship messages" on public.worship_messages;
create policy "Public reads published worship messages" on public.worship_messages for select to anon using(status='published' and archived_at is null);
drop policy if exists "Permitted staff read worship messages" on public.worship_messages;
create policy "Permitted staff read worship messages" on public.worship_messages for select to authenticated using(public.has_permission('website_content.view'));
drop policy if exists "Permitted staff manage worship messages" on public.worship_messages;
create policy "Permitted staff manage worship messages" on public.worship_messages for all to authenticated using(public.has_permission('website_content.manage')) with check(public.has_permission('website_content.manage'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('worship-message-images','worship-message-images',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Public worship message image read" on storage.objects;
create policy "Public worship message image read" on storage.objects for select to public using(bucket_id='worship-message-images');
drop policy if exists "Permitted worship message image insert" on storage.objects;
create policy "Permitted worship message image insert" on storage.objects for insert to authenticated with check(bucket_id='worship-message-images' and public.has_permission('website_content.manage'));
drop policy if exists "Permitted worship message image update" on storage.objects;
create policy "Permitted worship message image update" on storage.objects for update to authenticated using(bucket_id='worship-message-images' and public.has_permission('website_content.manage')) with check(bucket_id='worship-message-images' and public.has_permission('website_content.manage'));
drop policy if exists "Permitted worship message image delete" on storage.objects;
create policy "Permitted worship message image delete" on storage.objects for delete to authenticated using(bucket_id='worship-message-images' and public.has_permission('website_content.manage'));

insert into public.worship_messages(title,worship_date,video_url,status) values
 ('Sunday Worship Message','2026-07-12','https://www.facebook.com/watch/live/?ref=watch_permalink&v=1492382682573078','published'),
 ('Sunday Worship Message','2026-07-19','https://www.facebook.com/watch/live/?ref=watch_permalink&v=3172534489607540','published'),
 ('Sunday Worship Message','2026-07-26','https://www.facebook.com/watch/live/?ref=watch_permalink&v=2234869077269549','published')
on conflict(video_url) do nothing;

commit;
