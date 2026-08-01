-- Read-only verification for migration 022.
select batch.id,
       training.name,
       batch.status,
       public.get_current_training_session(batch.id) as current_session_id
from public.training_batches batch
join public.trainings training on training.id = batch.training_id
where batch.status in ('open', 'ongoing')
order by training.name;

select to_regprocedure('public.record_training_attendance(uuid,uuid,text)') as attendance_rpc,
       to_regprocedure('public.reopen_training_session(uuid,text)') as reopen_session_rpc,
       to_regprocedure('public.close_training_session_editing(uuid,text)') as close_session_rpc;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'training_attendance'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

select session.id, session.title, session.attendance_reopened_at,
       session.attendance_reopened_by
from public.training_sessions session
where session.attendance_reopened_at is not null
order by session.attendance_reopened_at desc;
