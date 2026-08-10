select to_regclass('public.member_registration_reviews') as review_queue;

select
  to_regprocedure('public.normalize_member_registration_name(text)') as normalization_function,
  to_regprocedure('public.submit_cell_group_member_registration(uuid,text,text,text,text,text,date,text,text,text,text)') as registration_function;

select
  public.normalize_member_registration_name('  Reden   Batchinila ') = 'reden batchinila' as whitespace_normalization_passes,
  public.normalize_member_registration_name('REDEN') = public.normalize_member_registration_name('reden') as case_normalization_passes,
  public.normalize_member_registration_name('Batchinila') <> public.normalize_member_registration_name('Batchinilla') as similar_spelling_remains_distinct;

select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'member_registration_reviews'
order by policyname;

select grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'submit_cell_group_member_registration'
order by grantee, privilege_type;

select has_table_privilege('anon', 'public.member_registration_reviews', 'SELECT') as anon_review_select_should_be_false,
       has_table_privilege('authenticated', 'public.member_registration_reviews', 'SELECT') as authenticated_table_grant_exists;
