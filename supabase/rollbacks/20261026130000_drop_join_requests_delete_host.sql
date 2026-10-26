-- Rollback zu supabase/migrations/20261026130000_drop_join_requests_delete_host.sql.
-- Stellt die Policy so wieder her, wie sie in 20261005164300_create_join_requests.sql steht
-- und bis zum 26.10.2026 live war, und gibt authenticated das DELETE-Recht zurueck (vorher
-- vergeben von postgres, ohne GRANT OPTION). Vor dem Rollback von 20261026120000 ausfuehren.

begin;

grant delete on public.join_requests to authenticated;

create policy join_requests_delete_host on public.join_requests
  for delete to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.host_id = (select auth.uid())));

commit;
