begin;

-- PostgreSQL text cannot contain chr(0). Migration 039 used that character in
-- the advisory-lock key, so registration failed before any member data could
-- be matched or written. Replace only that expression in the existing function
-- while preserving its current workflow and privileges.
do $$
declare
  function_signature constant regprocedure :=
    'public.submit_cell_group_member_registration(uuid,text,text,text,text,text,date,text,text,text,text)'::regprocedure;
  function_definition text;
begin
  select pg_get_functiondef(function_signature)
  into function_definition;

  if position('chr(0)' in function_definition) = 0 then
    if position('chr(31)' in function_definition) > 0 then
      return;
    end if;

    raise exception 'The member registration lock expression was not recognized';
  end if;

  execute replace(function_definition, 'chr(0)', 'chr(31)');
end;
$$;

commit;
