begin;

insert into public.trainings (name)
select 'Life Class'
where not exists (
  select 1
  from public.trainings
  where lower(regexp_replace(coalesce(name, ''), '[^a-z0-9]+', '', 'g'))
    like '%lifeclass%'
);

commit;
