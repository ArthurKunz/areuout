-- Link zuruecksetzen und Gast entfernen nehmen den Zugang ueber den Link wieder weg
-- (Final Review von Schritt 12, Befund A1/A3).
--
-- private.has_party_access und public.can_rsvp_to_event zaehlen eine Zeile in
-- private.invite_opens als Zugang: Adresse, exakter Punkt, Umfragen, Zusagen. Diese
-- Zeile wurde bisher nie geloescht. Wer den alten Link einmal angemeldet geoeffnet
-- hatte, behielt alles auch nach `Link zuruecksetzen`, obwohl der Dialog verspricht:
-- "Wer ihn schon hat, kommt nicht mehr rein." Und ein entfernter Gast behielt die
-- genaue Adresse, weil rsvps_drop_pool_responses nur seine Stimmen loescht.
--
-- Zwei Trigger, nach dem Muster von rsvps_drop_pool_responses: AFTER, Funktion in
-- private, SECURITY DEFINER mit search_path '', fuer die API-Rollen nicht aufrufbar.
--
-- 1. events_drop_invite_opens: aendert sich invite_code, verschwinden alle
--    invite_opens-Zeilen der Party. Wer zugesagt, vielleicht oder abgesagt hat, behaelt
--    den Zugang ueber seine Zeile in rsvps. Bearbeiten ohne neuen Code beruehrt nichts.
-- 2. rsvps_drop_invite_open: wird eine RSVP geloescht (Host entfernt einen Gast, oder
--    die Kaskade beim Loeschen einer Party oder eines Kontos), verschwindet auch die
--    invite_opens-Zeile dieser Person. Ein eigener Trigger statt einer Erweiterung von
--    rsvps_drop_pool_responses, damit dessen Name stimmt und der Rollback ein DROP ist.
--
-- Ein entfernter Gast kommt zurueck, indem er den (aktuellen) Link oeffnet; das legt
-- die Zeile neu an (entschieden, Nutzungsbedingungen Abschnitt 7).
--
-- Additiv und fuer main unschaedlich. Wird von Arthur im SQL-Editor ausgefuehrt, weil das
-- MCP-Werkzeug Anweisungen mit DELETE ablehnt; danach die Version per INSERT in
-- supabase_migrations.schema_migrations eintragen (supabase/migrations/README.md).

create or replace function private.drop_invite_opens_on_new_code()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  delete from private.invite_opens io
  where io.event_id = new.id;
  return null;
end;
$function$;

revoke all on function private.drop_invite_opens_on_new_code() from public, anon, authenticated;

create trigger events_drop_invite_opens
  after update of invite_code on public.events
  for each row
  when (old.invite_code is distinct from new.invite_code)
  execute function private.drop_invite_opens_on_new_code();

create or replace function private.drop_invite_open_on_rsvp_delete()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  delete from private.invite_opens io
  where io.event_id = old.event_id
    and io.user_id = old.user_id;
  return null;
end;
$function$;

revoke all on function private.drop_invite_open_on_rsvp_delete() from public, anon, authenticated;

create trigger rsvps_drop_invite_open
  after delete on public.rsvps
  for each row execute function private.drop_invite_open_on_rsvp_delete();
