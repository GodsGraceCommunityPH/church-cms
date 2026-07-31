create or replace function public.get_training_overview_stats()
returns table (
  training_name text,
  total_enrolled bigint,
  completed bigint,
  in_progress bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.name as training_name,
    count(mt.id) as total_enrolled,
    count(mt.id) filter (
      where lower(regexp_replace(coalesce(mt.status, ''), '[^a-z0-9]+', '', 'g'))
        in ('complete', 'completed', 'graduated')
    ) as completed,
    count(mt.id) filter (
      where lower(regexp_replace(coalesce(mt.status, ''), '[^a-z0-9]+', '', 'g'))
        not in (
          'complete',
          'completed',
          'graduated',
          'withdrawn',
          'cancelled',
          'canceled',
          'inactive'
        )
    ) as in_progress
  from public.trainings t
  left join public.member_trainings mt on mt.training_id = t.id
  where t.name in ('SUYNL', 'Life Class', 'SOL 1', 'SOL 2', 'SOL 3')
  group by t.id, t.name;
$$;

revoke all on function public.get_training_overview_stats() from public;
grant execute on function public.get_training_overview_stats() to anon;
grant execute on function public.get_training_overview_stats() to authenticated;
