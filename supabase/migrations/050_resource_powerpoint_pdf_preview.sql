begin;
alter table public.resources
 add column if not exists preview_storage_path text,
 add column if not exists preview_file_name text,
 add column if not exists preview_mime_type text,
 add column if not exists preview_file_size bigint;
create unique index if not exists resources_preview_storage_path_unique on public.resources(preview_storage_path) where preview_storage_path is not null;
alter table public.resources drop constraint if exists resources_preview_metadata_complete;
alter table public.resources add constraint resources_preview_metadata_complete check(
 (preview_storage_path is null and preview_file_name is null and preview_mime_type is null and preview_file_size is null)
 or (preview_storage_path is not null and nullif(btrim(preview_file_name),'') is not null and preview_mime_type='application/pdf' and preview_file_size>0 and preview_file_size<=104857600)
);
commit;
