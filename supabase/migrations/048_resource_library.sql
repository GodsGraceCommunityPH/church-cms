begin;
insert into public.permissions(code,name,module,description) values
 ('resources.view','View resource library','resources','Browse, view, download, and share authenticated teaching resources.'),
 ('resources.manage','Manage resource library','resources','Upload, edit, and delete teaching resources.')
on conflict(code) do update set name=excluded.name,module=excluded.module,description=excluded.description,updated_at=now();
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r join public.permissions p on p.code in('resources.view','resources.manage') where r.code='administrator' on conflict do nothing;

create table if not exists public.resources(
 id uuid primary key default gen_random_uuid(), title text not null, description text, category text not null,
 original_file_name text not null, file_type text not null, mime_type text not null, file_size bigint not null,
 storage_path text unique, created_by uuid references public.users(id) on delete set null default auth.uid(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint resources_title_not_blank check(btrim(title)<>''),
 constraint resources_category_check check(category in('cell_discussion','training','ministry','other')),
 constraint resources_file_type_check check(file_type in('pdf','ppt','pptx','jpg','jpeg','png','webp')),
 constraint resources_file_size_check check(file_size>0 and file_size<=104857600)
);
create index if not exists resources_category_title_idx on public.resources(category,lower(title));
create or replace function public.touch_resource_updated_at() returns trigger language plpgsql set search_path='' as $$begin new.updated_at=now();return new;end$$;
drop trigger if exists resources_touch_updated_at on public.resources;
create trigger resources_touch_updated_at before update on public.resources for each row execute function public.touch_resource_updated_at();
alter table public.resources enable row level security;
revoke all on public.resources from anon; grant select,insert,update,delete on public.resources to authenticated;
create policy "Resources view" on public.resources for select to authenticated using(public.has_permission('resources.view'));
create policy "Resources manage" on public.resources for all to authenticated using(public.has_permission('resources.manage')) with check(public.has_permission('resources.manage'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('teaching-resources','teaching-resources',false,104857600,array['application/pdf','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "Resource files view" on storage.objects for select to authenticated using(bucket_id='teaching-resources' and public.has_permission('resources.view'));
create policy "Resource files insert" on storage.objects for insert to authenticated with check(bucket_id='teaching-resources' and public.has_permission('resources.manage'));
create policy "Resource files update" on storage.objects for update to authenticated using(bucket_id='teaching-resources' and public.has_permission('resources.manage')) with check(bucket_id='teaching-resources' and public.has_permission('resources.manage'));
create policy "Resource files delete" on storage.objects for delete to authenticated using(bucket_id='teaching-resources' and public.has_permission('resources.manage'));
commit;
