-- Run after 040_worship_messages_admin_manager.sql.
select code from public.permissions
where code in ('website_content.view','website_content.manage')
order by code;

select table_name
from information_schema.tables
where table_schema='public' and table_name='worship_messages';

select id, title, worship_date, video_url, status, thumbnail_path, archived_at
from public.worship_messages
order by worship_date desc;

select policyname, roles, cmd
from pg_policies
where schemaname='public' and tablename='worship_messages'
order by policyname;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id='worship-message-images';

select policyname, roles, cmd
from pg_policies
where schemaname='storage' and tablename='objects'
  and policyname ilike '%worship message%'
order by policyname;

-- Expected: exactly three seeded published messages until staff add more.
select status, count(*)
from public.worship_messages
where archived_at is null
group by status
order by status;
