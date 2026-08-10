select
  has_function_privilege(
    'authenticated',
    'public.normalize_member_registration_name(text)',
    'EXECUTE'
  ) as authenticated_can_normalize_member_names,
  has_function_privilege(
    'anon',
    'public.normalize_member_registration_name(text)',
    'EXECUTE'
  ) as anon_cannot_normalize_member_names_should_be_false;
