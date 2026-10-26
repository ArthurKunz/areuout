-- Rollback zu supabase/migrations/20261026104449_push_new_join_requests.sql.
-- Entfernt den Trigger join_requests_push_new und seine Funktion (mit dem eigenen
-- Fehler-Block); danach schickt eine neue Anfrage keine Mitteilung mehr. queue_push bleibt
-- stehen, sein Rollback ist eine eigene Datei.

begin;

drop trigger join_requests_push_new on public.join_requests;
drop function private.push_new_join_request();

commit;
