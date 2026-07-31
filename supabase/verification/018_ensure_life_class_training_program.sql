select id, name
from public.trainings
where lower(regexp_replace(coalesce(name, ''), '[^a-z0-9]+', '', 'g'))
  like '%lifeclass%';
