select count(*) as enrollments_without_roster_order
from public.member_trainings
where batch_id is not null
  and roster_order is null;

select batch_id, roster_order, count(*) as duplicate_count
from public.member_trainings
where batch_id is not null
  and archived_at is null
group by batch_id, roster_order
having count(*) > 1;

select id, name, gender_section_order
from public.training_batches
where gender_section_order is null
   or cardinality(gender_section_order) <> 2
   or not (gender_section_order <@ array['female', 'male']::text[])
   or not (gender_section_order @> array['female', 'male']::text[]);

select p.proname,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'save_training_roster_order';
