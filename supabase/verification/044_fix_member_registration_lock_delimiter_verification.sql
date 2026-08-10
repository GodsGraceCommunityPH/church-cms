select
  position(
    'chr(0)'
    in pg_get_functiondef(
      'public.submit_cell_group_member_registration(uuid,text,text,text,text,text,date,text,text,text,text)'::regprocedure
    )
  ) = 0 as null_delimiter_removed,
  position(
    'chr(31)'
    in pg_get_functiondef(
      'public.submit_cell_group_member_registration(uuid,text,text,text,text,text,date,text,text,text,text)'::regprocedure
    )
  ) > 0 as safe_delimiter_present;
