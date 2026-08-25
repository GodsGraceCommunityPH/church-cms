begin;

alter table public.church_life_albums
  add column if not exists cover_photo_id uuid references public.church_life_photos(id) on delete set null;

create or replace function public.validate_church_life_album_cover() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.cover_photo_id is not null and not exists (
    select 1 from public.church_life_photos photo
    where photo.id = new.cover_photo_id and photo.album_id = new.id
  ) then
    raise exception 'Church Life cover photo must belong to the same album' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists church_life_album_cover_guard on public.church_life_albums;
create trigger church_life_album_cover_guard
before insert or update of cover_photo_id on public.church_life_albums
for each row execute function public.validate_church_life_album_cover();

commit;
