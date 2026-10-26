-- Push, Teil 5b: jede neue Anfrage (Zeile in public.join_requests) schickt dem Host der
-- Party eine Mitteilung. Titel ist der Partytitel, der Text "Neue Anfrage für deine Party",
-- data nur die Party-ID; kein Name der anfragenden Person (CLAUDE.md).
--
-- Ausloeser ist new.user_id, nicht auth.uid(): so stimmt der Trigger, egal welcher Weg die
-- Zeile einfuegt (heute nur request_to_join). Alle Pruefungen (kein Geraet, Blockierung,
-- Party vorbei, kein Geheimnis) liegen in private.queue_push, das jeden eigenen Fehler
-- abfaengt. Der innere Block hier faengt zusaetzlich Fehler im Trigger selbst ab (die
-- Abfrage des Hosts, der Aufruf): die Anfrage gelingt immer, auch wenn Push scheitert.
--
-- AFTER INSERT feuert nur fuer wirklich eingefuegte Zeilen. Eine zurueckgerollte Anfrage
-- (voll, Limit von 10, ...) nimmt die Zeile in der pg_net-Warteschlange mit.

begin;

create function private.push_new_join_request()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  begin
    perform private.queue_push(
      (select e.host_id from public.events e where e.id = new.event_id),
      new.user_id,
      new.event_id,
      'Neue Anfrage für deine Party');
  exception when others then
    raise warning 'push trigger failed for %: %', new.event_id, sqlerrm;
  end;
  return null;
end;
$function$;

revoke all on function private.push_new_join_request() from public, anon, authenticated;

create trigger join_requests_push_new
  after insert on public.join_requests
  for each row execute function private.push_new_join_request();

commit;
