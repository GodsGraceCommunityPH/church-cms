begin;

alter table public.member_trainings
  add column if not exists roster_order integer;

alter table public.training_batches
  add column if not exists gender_section_order text[] not null
  default array['female', 'male']::text[];

update public.member_trainings enrollment
set roster_order = ranked.desired_order
from (
  select id,
         row_number() over (
           partition by batch_id
           order by created_at, id
         )::integer as desired_order
  from public.member_trainings
  where batch_id is not null
) ranked
where enrollment.id = ranked.id
  and enrollment.roster_order is null;

create index if not exists member_trainings_batch_roster_order_idx
  on public.member_trainings(batch_id, roster_order, created_at);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'training_batches_gender_section_order_check'
      and conrelid = 'public.training_batches'::regclass
  ) then
    alter table public.training_batches
      add constraint training_batches_gender_section_order_check
      check (
        cardinality(gender_section_order) = 2
        and gender_section_order <@ array['female', 'male']::text[]
        and gender_section_order @> array['female', 'male']::text[]
      );
  end if;
end;
$$;

create or replace function public.save_training_roster_order(
  p_batch_id uuid,
  p_member_training_ids uuid[],
  p_gender_section_order text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('training.attendance') then
    raise exception 'training.attendance permission required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.training_batches where id = p_batch_id
  ) then
    raise exception 'Training class not found' using errcode = 'P0002';
  end if;

  if cardinality(p_gender_section_order) <> 2
     or not (p_gender_section_order <@ array['female', 'male']::text[])
     or not (p_gender_section_order @> array['female', 'male']::text[]) then
    raise exception 'Gender section order must contain female and male exactly once' using errcode = '22023';
  end if;

  if cardinality(p_member_training_ids) <> (
    select count(distinct requested_id)
    from unnest(p_member_training_ids) requested(requested_id)
  ) then
    raise exception 'Roster order contains duplicate enrollments' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(p_member_training_ids) requested(requested_id)
    left join public.member_trainings enrollment
      on enrollment.id = requested.requested_id
     and enrollment.batch_id = p_batch_id
     and enrollment.archived_at is null
    where enrollment.id is null
  ) then
    raise exception 'Roster order contains an enrollment outside this class' using errcode = '22023';
  end if;

  update public.member_trainings enrollment
  set roster_order = requested.position::integer
  from unnest(p_member_training_ids) with ordinality requested(id, position)
  where enrollment.id = requested.id
    and enrollment.batch_id = p_batch_id
    and enrollment.archived_at is null;

  update public.training_batches
  set gender_section_order = p_gender_section_order,
      updated_at = now()
  where id = p_batch_id;
end;
$$;

revoke all on function public.save_training_roster_order(uuid, uuid[], text[]) from public;
revoke all on function public.save_training_roster_order(uuid, uuid[], text[]) from anon;
grant execute on function public.save_training_roster_order(uuid, uuid[], text[]) to authenticated;

commit;
