-- Ein entfernter Gast verliert seine Stimmen und Antworten (Schritt 12 des Redesigns,
-- entschieden am 09.10.2026; offen seit Schritt 7).
--
-- Bisher blieb sein Name in den Listen `Votes anzeigen` und `Antworten anzeigen`
-- stehen, die jedes Mitglied der Party sieht, obwohl er nicht mehr dazugehoert. Der
-- Host kann diese Zeilen nicht selbst loeschen: pool_responses_delete_own gilt nur fuer
-- eigene Zeilen. Deshalb ein Trigger, nach demselben Muster wie
-- rsvps_drop_join_request: AFTER auf rsvps, Funktion in private, SECURITY DEFINER mit
-- search_path '', fuer die API-Rollen nicht aufrufbar.
--
-- Er greift bei jedem DELETE einer RSVP: wenn der Host jemanden entfernt
-- (rsvps_delete_host), wenn ein Gast der alten App seine Zeile selbst loescht
-- (rsvps_delete_own), und in der Kaskade beim Loeschen einer Party oder eines Kontos,
-- wo die Zeilen ohnehin verschwinden. `abgesagt` ist ein UPDATE und beruehrt nichts.
-- Ein entfernter Gast, der ueber den Link zurueckkommt, faengt ohne Stimmen neu an.
--
-- Additiv und fuer main unschaedlich. Wird von Arthur im SQL-Editor ausgefuehrt, weil das
-- MCP-Werkzeug Anweisungen mit DELETE ablehnt; danach die Version per INSERT in
-- supabase_migrations.schema_migrations eintragen und den Dateinamen anpassen
-- (supabase/migrations/README.md).

create or replace function private.drop_pool_responses_on_rsvp_delete()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  delete from public.pool_responses pr
  using public.pools p
  where p.id = pr.pool_id
    and p.event_id = old.event_id
    and pr.user_id = old.user_id;
  return null;
end;
$function$;

revoke all on function private.drop_pool_responses_on_rsvp_delete() from public, anon, authenticated;

create trigger rsvps_drop_pool_responses
  after delete on public.rsvps
  for each row execute function private.drop_pool_responses_on_rsvp_delete();
