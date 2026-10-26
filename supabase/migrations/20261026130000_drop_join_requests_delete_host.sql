-- Push, Teil 5e: Ablehnen geht nur noch ueber decline_join_request. Die alte DELETE-Policy
-- join_requests_delete_host faellt, und authenticated verliert das DELETE-Recht auf der
-- Tabelle. So kann kein Host eine Anfrage mehr an der Mitteilung vorbei loeschen.
--
-- Erst nach dem Deploy: RequestsPage ruft seit bb12059 decline_join_request auf, und die App
-- laedt www.areuout.de, es gibt also keine alte Fassung mehr, die direkt loescht.
--
-- Was weiter loescht, laeuft als SECURITY DEFINER und braucht das Recht nicht:
-- decline_join_request, accept_join_request, block_user und die Trigger-Funktionen
-- private.drop_join_request_on_rsvp und private.drop_join_requests_when_public. Die
-- ON-DELETE-CASCADE-Fremdschluessel von events und profiles laufen mit den Rechten des
-- Tabellen-Owners, Party loeschen und delete_self gehen also weiter.
--
-- Enthaelt DELETE: im SQL-Editor ausgefuehrt, Version von Hand eingetragen.

begin;

drop policy join_requests_delete_host on public.join_requests;

revoke delete on public.join_requests from authenticated;

commit;
