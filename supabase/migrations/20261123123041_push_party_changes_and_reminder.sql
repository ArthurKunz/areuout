-- App 2.1 (Vault: App 2.1 Plan, entschieden mit Arthur am 2026-11-23): zwei neue Pushs.
--
-- 1. Broadcast bei Aenderungen. Aendert der Host (oder ein Admin bei einer Agent-Party)
--    Datum, Uhrzeit, Ende oder Ort, bekommt jeder Gast mit Zusage oder Vielleicht eine Push:
--    Titel = Partytitel, Text 'Geändert: Datum, Uhrzeit, Ort' (nur die betroffenen Woerter),
--    wie schon die Agent-Vorschlaege. Wird die Party geloescht (vom Host, von einem Admin
--    ueber remove_agent_event oder weil das Konto des Hosts geloescht wird), kommt
--    'Die Party wurde abgesagt'. Motto, Dresscode, Bild, Preis und alles andere: keine Push.
--    approve_agent_proposal schickte bei 'change' bisher selbst eine Push; die kommt jetzt
--    vom Trigger, darum endet die Funktion bei 'change' vor ihrer eigenen Schleife (sonst
--    kaeme sie doppelt). Absagen ueber Vorschlaege ('cancel') schickt sie weiter selbst.
--
-- 2. Erinnerung an Unentschlossene. Stuendlich (Minute 15) sucht private.send_party_reminders
--    Partys, die in 47 bis 48 Stunden beginnen und noch keine Erinnerung hatten. Empfaenger:
--    Gaeste mit Vielleicht und alle, die den Einladungslink geoeffnet, aber nie geantwortet
--    haben (private.invite_opens ohne Zeile in rsvps). Text ohne Uhrzeit (CLAUDE.md).
--    private.party_reminders merkt sich jede Party, damit es pro Party genau eine gibt.
--
-- Alle Pushs laufen ueber private.queue_push: kein Name, keine Adresse, keine Uhrzeit, nie
-- an den Ausloeser, nie bei einer Blockierung, nie fuer eine vergangene Party. Jeder Fehler
-- wird zur Warnung; Speichern, Loeschen und Freigeben gelingen immer.
--
-- Keine neuen Kosten: pg_cron und pg_net laufen schon (Party-Agent), send-push auch.
-- Rollback: supabase/rollbacks/20261123123041_push_party_changes_and_reminder.sql

-- 1a. Aenderungen

create function private.push_party_changes()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_parts text[];
  v_guest uuid;
  v_actor uuid := coalesce((select auth.uid()), new.host_id);
begin
  begin
    v_parts := array_remove(array[
      case when (old.event_date at time zone 'Europe/Berlin')::date
             <> (new.event_date at time zone 'Europe/Berlin')::date then 'Datum' end,
      case when (old.event_date at time zone 'Europe/Berlin')::time
             <> (new.event_date at time zone 'Europe/Berlin')::time
             or old.is_all_day is distinct from new.is_all_day then 'Uhrzeit' end,
      case when old.ends_at is distinct from new.ends_at then 'Ende' end,
      case when old.location is distinct from new.location
             or old.lat is distinct from new.lat
             or old.lng is distinct from new.lng then 'Ort' end
    ], null);

    if cardinality(v_parts) = 0 then
      return null;
    end if;

    for v_guest in
      select r.user_id from public.rsvps r
      where r.event_id = new.id and r.status in ('going', 'maybe')
    loop
      perform private.queue_push(v_guest, v_actor, new.id, 'Geändert: ' || array_to_string(v_parts, ', '));
    end loop;
  exception when others then
    raise warning 'change push not queued for %: %', new.id, sqlerrm;
  end;
  return null;
end;
$function$;

create trigger events_push_changes
  after update of event_date, ends_at, is_all_day, location, lat, lng on public.events
  for each row
  when (old.event_date is distinct from new.event_date
     or old.ends_at is distinct from new.ends_at
     or old.is_all_day is distinct from new.is_all_day
     or old.location is distinct from new.location
     or old.lat is distinct from new.lat
     or old.lng is distinct from new.lng)
  execute function private.push_party_changes();

-- 1b. Absage durch Loeschen. BEFORE DELETE: Party und Zusagen sind noch da, queue_push
-- findet den Titel. Gesendet wird erst nach dem COMMIT; rollt das Loeschen zurueck, nichts.

create function private.push_party_cancelled()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_guest uuid;
  v_actor uuid := coalesce((select auth.uid()), old.host_id);
begin
  begin
    for v_guest in
      select r.user_id from public.rsvps r
      where r.event_id = old.id and r.status in ('going', 'maybe')
    loop
      perform private.queue_push(v_guest, v_actor, old.id, 'Die Party wurde abgesagt');
    end loop;
  exception when others then
    raise warning 'cancel push not queued for %: %', old.id, sqlerrm;
  end;
  return old;
end;
$function$;

create trigger events_push_cancelled
  before delete on public.events
  for each row
  execute function private.push_party_cancelled();

-- 1c. Keine doppelte Push mehr bei freigegebenen Agent-Aenderungen.

do $migration$
declare
  v_def text;
  c_old constant text := '  -- Push an jeden Gast mit Zusage oder Vielleicht.';
  c_new constant text := '  -- Aenderungen meldet seit 2026-11-23 der Trigger events_push_changes.
  if v_candidate.kind = ''change'' then
    return;
  end if;

  -- Push an jeden Gast mit Zusage oder Vielleicht.';
begin
  v_def := pg_get_functiondef('public.approve_agent_proposal(uuid)'::regprocedure);
  if (length(v_def) - length(replace(v_def, c_old, ''))) / length(c_old) <> 1 then
    raise exception 'approve_agent_proposal: Push-Block nicht genau einmal gefunden';
  end if;
  execute replace(v_def, c_old, c_new);
end
$migration$;

-- 2. Erinnerung 48 Stunden vorher

create table private.party_reminders (
  event_id uuid primary key references public.events (id) on delete cascade,
  sent_at timestamptz not null default now()
);
revoke all on table private.party_reminders from public, anon, authenticated;

create function private.send_party_reminders()
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_event record;
  v_guest uuid;
begin
  for v_event in
    select e.id, e.host_id from public.events e
    where e.event_date > now() + interval '47 hours'
      and e.event_date <= now() + interval '48 hours'
      and not exists (select 1 from private.party_reminders pr where pr.event_id = e.id)
  loop
    insert into private.party_reminders (event_id) values (v_event.id);

    for v_guest in
      select r.user_id from public.rsvps r
      where r.event_id = v_event.id and r.status = 'maybe'
      union
      select io.user_id from private.invite_opens io
      where io.event_id = v_event.id
        and not exists (select 1 from public.rsvps r
                        where r.event_id = io.event_id and r.user_id = io.user_id)
    loop
      begin
        perform private.queue_push(v_guest, v_event.host_id, v_event.id, 'Bald ist es so weit. Bist du dabei?');
      exception when others then
        raise warning 'reminder push not queued for %: %', v_event.id, sqlerrm;
      end;
    end loop;
  end loop;
end;
$function$;

revoke all on function private.push_party_changes() from public, anon, authenticated;
revoke all on function private.push_party_cancelled() from public, anon, authenticated;
revoke all on function private.send_party_reminders() from public, anon, authenticated;

select cron.schedule('party-reminders', '15 * * * *', 'select private.send_party_reminders()');
