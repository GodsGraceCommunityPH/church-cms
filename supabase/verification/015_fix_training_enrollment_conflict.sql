select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'enroll_training_batch_students';

select has_function_privilege(
  'anon',
  'public.enroll_training_batch_students(uuid, uuid[])',
  'execute'
) as anon_can_enroll,
has_function_privilege(
  'authenticated',
  'public.enroll_training_batch_students(uuid, uuid[])',
  'execute'
) as authenticated_can_call;
