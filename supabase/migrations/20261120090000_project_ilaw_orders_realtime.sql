-- Project Ilaw order changes (payment confirmations, fulfilment updates, and
-- staff-assisted payment retries) must reach open staff sessions without a
-- manual browser refresh. The table is added to the default Supabase realtime
-- publication; row level security continues to decide which rows each session
-- may subscribe to and read.

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.project_ilaw_orders;
  end if;
exception when duplicate_object then null;
end $$;
