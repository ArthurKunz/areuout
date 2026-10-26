-- Rollback zu supabase/migrations/20261026120000_add_decline_join_request.sql.
-- Erst ausfuehren, wenn RequestsPage wieder direkt loescht und join_requests_delete_host
-- (samt DELETE-Recht fuer authenticated) wieder steht: sonst kann kein Host mehr ablehnen.
-- Danach die Typen neu erzeugen.

begin;

drop function public.decline_join_request(uuid, uuid);

commit;
