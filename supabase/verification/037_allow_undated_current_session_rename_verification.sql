select to_regprocedure('public.update_training_session_details(uuid,text,date)') as update_session_rpc;
select proacl from pg_proc where oid='public.update_training_session_details(uuid,text,date)'::regprocedure;

-- Read-only audit: legacy undated sessions that can benefit from this correction.
select batch.status as class_status,count(*) as undated_uncompleted_sessions
from public.training_sessions session
join public.training_batches batch on batch.id=session.batch_id
where session.session_date is null
  and batch.status in ('open','ongoing')
  and not exists(select 1 from public.training_attendance attendance where attendance.session_id=session.id)
group by batch.status order by batch.status;
