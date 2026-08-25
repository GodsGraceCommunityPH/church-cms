begin;

create table public.church_life_albums (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  display_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint church_life_album_title_not_blank check (btrim(title) <> ''),
  constraint church_life_album_slug_valid check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table public.church_life_photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.church_life_albums(id) on delete cascade,
  image_path text not null,
  thumbnail_path text,
  storage_path text,
  display_order integer not null,
  created_at timestamptz not null default now(),
  unique(album_id, display_order),
  constraint church_life_photo_path_not_blank check (btrim(image_path) <> '')
);

create index church_life_albums_order_idx on public.church_life_albums(display_order, created_at);
create index church_life_photos_order_idx on public.church_life_photos(album_id, display_order);

create or replace function public.touch_church_life_album_updated_at() returns trigger
language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end; $$;
create trigger church_life_albums_touch_updated_at before update on public.church_life_albums
for each row execute function public.touch_church_life_album_updated_at();

alter table public.church_life_albums enable row level security;
alter table public.church_life_photos enable row level security;
revoke all on public.church_life_albums, public.church_life_photos from public, anon, authenticated;
grant select on public.church_life_albums, public.church_life_photos to anon, authenticated;
grant insert, update, delete on public.church_life_albums, public.church_life_photos to authenticated;

create policy "Public reads Church Life albums" on public.church_life_albums for select to public using (true);
create policy "Staff reads Church Life albums" on public.church_life_albums for select to authenticated using (public.has_permission('website_content.view'));
create policy "Staff manages Church Life albums" on public.church_life_albums for all to authenticated
using (public.has_permission('website_content.manage')) with check (public.has_permission('website_content.manage'));
create policy "Public reads Church Life photos" on public.church_life_photos for select to public using (true);
create policy "Staff reads Church Life photos" on public.church_life_photos for select to authenticated using (public.has_permission('website_content.view'));
create policy "Staff manages Church Life photos" on public.church_life_photos for all to authenticated
using (public.has_permission('website_content.manage')) with check (public.has_permission('website_content.manage'));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values
  ('church-life-images', 'church-life-images', true, 15728640, array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict(id) do update set public=true, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
create policy "Public Church Life image read" on storage.objects for select to public using(bucket_id='church-life-images');
create policy "Staff Church Life image insert" on storage.objects for insert to authenticated
with check(bucket_id='church-life-images' and public.has_permission('website_content.manage'));
create policy "Staff Church Life image update" on storage.objects for update to authenticated
using(bucket_id='church-life-images' and public.has_permission('website_content.manage'))
with check(bucket_id='church-life-images' and public.has_permission('website_content.manage'));
create policy "Staff Church Life image delete" on storage.objects for delete to authenticated
using(bucket_id='church-life-images' and public.has_permission('website_content.manage'));

insert into public.church_life_albums(slug,title,description,display_order) values
 ('lighthouse','Lighthouse','Faith, friendship, and life together.',1),
 ('camp-day-1','Camp — Day 1','Fellowship, worship, and shared moments from camp.',2),
 ('camp-day-2','Camp — Day 2','Community activities and the closing day of camp.',3),
 ('40th-anniversary','40th Anniversary','Celebrating four decades of God''s faithfulness.',4),
 ('41st-anniversary','41st Anniversary','Worship, fellowship, and another year of grace.',5),
 ('42nd-anniversary','42nd Anniversary','Beyond the Four Walls — “Therefore go and make disciples of all nations…” — Matthew 28:19–20',6)
on conflict(slug) do update set title=excluded.title, description=excluded.description, display_order=excluded.display_order;

with album_counts(slug, photo_count) as (values
 ('lighthouse',20),('camp-day-1',18),('camp-day-2',15),('40th-anniversary',24),('41st-anniversary',24),('42nd-anniversary',47)
)
insert into public.church_life_photos(album_id,image_path,thumbnail_path,display_order)
select a.id, '/images/galleries/'||a.slug||'/'||lpad(n::text,2,'0')||'.webp',
 '/images/galleries/'||a.slug||'/'||lpad(n::text,2,'0')||'-thumb.webp', n
from album_counts c join public.church_life_albums a using(slug)
cross join lateral generate_series(1,c.photo_count) n
on conflict(album_id,display_order) do nothing;

commit;
