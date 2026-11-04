begin;

do $$ begin
  if public.normalize_member_mobile('0961-607-1685') <> '639616071685'
     or public.normalize_member_mobile('09616071685') <> '639616071685'
     or public.normalize_member_mobile('+63 961 607 1685') <> '639616071685' then
    raise exception 'Philippine mobile normalization regression';
  end if;
  if not public.member_first_names_similar('Jesmer','Jesmer Christian')
     or not public.member_first_names_similar('Jesmer Christian','Jesmer') then
    raise exception 'Extended first-name match regression';
  end if;
  if public.member_first_names_similar('Jesmer','Jesus') then
    raise exception 'Unrelated first names were classified as similar';
  end if;
  if exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='members' and c.contype='u'
      and pg_get_constraintdef(c.oid) ilike '%mobile%'
  ) then raise exception 'Mobile uniqueness must not be imposed'; end if;
end $$;

rollback;
