-- Push, Teil 5d: Ablehnen wird eine Funktion. decline_join_request(event_id, user_id) loescht
-- die Anfrage und schickt der abgelehnten Person eine Mitteilung: Titel der Partytitel, Text
-- "Deine Anfrage wurde leider abgelehnt", data nur die Party-ID; kein Name des Hosts
-- (CLAUDE.md). Die Person darf danach wieder anfragen (SCHEMA.md 9b).
--
-- Gebaut wie accept_join_request: nur der Host der Party (42501 sonst, innen geprueft), eine
-- verschwundene Anfrage wird mit einem deutschen Satz abgelehnt. Keine Frist: auch die
-- DELETE-Policy join_requests_delete_host kennt keine, und nach dem Ende der Party schickt
-- queue_push ohnehin nichts. Keine Advisory-Sperre: laufen Annehmen und Ablehnen gleichzeitig,
-- loeschen beide dieselbe Zeile, und die Zeilensperre laesst nur einen gewinnen.
--
-- Der Push-Block steht nach dem DELETE und faengt jeden Fehler ab, auch einen fehlenden
-- queue_push (wie in accept_join_request und im Trigger join_requests_push_new): das Ablehnen
-- gelingt immer, auch wenn Push scheitert. Gesendet wird erst nach dem COMMIT.
--
-- join_requests_delete_host bleibt vorerst stehen, weil die ausgelieferte App noch direkt
-- loescht. Sie faellt erst mit einer eigenen Migration, wenn RequestsPage mit dieser Funktion
-- live ist.
--
-- Enthaelt DELETE: im SQL-Editor ausgefuehrt, Version von Hand eingetragen.

begin;

create function public.decline_join_request(p_event_id uuid, p_user_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_host_id uuid;
begin
  select e.host_id into v_host_id
  from public.events e
  where e.id = p_event_id;

  if not found then
    raise exception 'Diese Party gibt es nicht mehr.' using errcode = 'P0002';
  end if;

  if v_host_id is distinct from (select auth.uid()) then
    raise exception 'Nur der Host kann Anfragen ablehnen.' using errcode = '42501';
  end if;

  delete from public.join_requests jr where jr.event_id = p_event_id and jr.user_id = p_user_id;
  if not found then
    raise exception 'Diese Anfrage gibt es nicht mehr.' using errcode = 'P0002';
  end if;

  begin
    perform private.queue_push(p_user_id, v_host_id, p_event_id, 'Deine Anfrage wurde leider abgelehnt');
  exception when others then
    raise warning 'push trigger failed for %: %', p_event_id, sqlerrm;
  end;
end;
$function$;

revoke all on function public.decline_join_request(uuid, uuid) from public, anon;
grant execute on function public.decline_join_request(uuid, uuid) to authenticated;

commit;
