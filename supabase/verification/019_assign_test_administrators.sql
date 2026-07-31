select
  auth_user.email,
  portal_user.is_active,
  role_record.code as role_code
from auth.users auth_user
join public.users portal_user on portal_user.id = auth_user.id
join public.user_roles assignment on assignment.user_id = portal_user.id
join public.roles role_record on role_record.id = assignment.role_id
where lower(auth_user.email) in ('admin1@ggccc.com', 'test@ggccc.com')
  and role_record.code = 'administrator'
order by auth_user.email;
