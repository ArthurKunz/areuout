-- Party Agent, Schritt 6: Aenderungs- und Absage-Vorschlaege fuer freigegebene Agent-Events
-- und die Push an die Gaeste (Vault: Party Agent, Abschnitte 6 Schritt 11, 7, 8 "Review"
-- und "Cancellation").
--
-- Der Agent prueft bei jedem Lauf die freigegebenen Events nach und legt Vorschlaege als
-- private.agent_candidates mit kind 'change' oder 'cancel' an (Spalten aus Schritt 2). Die
-- Zeile traegt den vorgeschlagenen Stand des Events, `changes` nennt nur die geaenderten
-- Felder (starts_at, ends_at, location/lat/lng, price). Live geht nichts ohne Arthur:
--
-- - get_agent_proposals(): die offenen Vorschlaege, frueheste Party zuerst, mit dem
--   jetzigen und dem vorgeschlagenen Stand. Vorher laufen Vorschlaege ab, deren Event
--   schon begonnen hat.
-- - approve_agent_proposal(id): uebernimmt nur die Felder aus `changes` in events, oder
--   setzt bei einer Absage agent_event_details.cancelled_at. Danach bekommt jeder Gast mit
--   Zusage oder Vielleicht eine Push ueber private.queue_push: Titel = Partytitel, Text
--   'Geändert: Datum, Uhrzeit' oder 'Die Party wurde abgesagt', nie ein Name (CLAUDE.md).
--   Die Push kann die Freigabe nie scheitern lassen.
-- - Verwerfen geht ueber discard_agent_candidate (Schritt 4), das jede offene Zeile nimmt.
--
-- Dazu: hoechstens ein offener Vorschlag pro Event und Art, und zwei Zaehler im Lauf-Log.
--
-- Rollback: supabase/rollbacks/20261114192638_add_agent_proposals.sql

alter table private.agent_runs
  add column rechecked integer not null default 0 check (rechecked >= 0),
  add column proposals integer not null default 0 check (proposals >= 0);

create unique index agent_candidates_one_open_proposal
  on private.agent_candidates (event_id, kind)
  where status = 'draft' and kind in ('change', 'cancel');

create function public.get_agent_proposals()
 returns table (
  id uuid,
  kind text,
  event_id uuid,
  title text,
  event_date timestamptz,
  ends_at timestamptz,
  location text,
  price numeric,
  changes jsonb,
  new_starts_at timestamptz,
  new_ends_at timestamptz,
  new_location text,
  new_price numeric,
  source_url text
 )
 language plpgsql
 security definer
 set search_path to ''
as $function$
#variable_conflict use_column
begin
  if not private.is_admin() then
    raise exception 'Nur Admins dürfen das.' using errcode = '42501';
  end if;

  update private.agent_candidates c
  set status = 'expired', decided_at = now()
  from public.events e
  where e.id = c.event_id
    and c.status = 'draft' and c.kind in ('change', 'cancel')
    and e.event_date <= now();

  return query
  select c.id, c.kind, e.id, e.title, e.event_date, e.ends_at, e.location, e.price,
         c.changes, c.starts_at, c.ends_at, c.location, c.price, d.source_url
  from private.agent_candidates c
  join public.events e on e.id = c.event_id
  join public.agent_event_details d on d.event_id = e.id
  where c.status = 'draft' and c.kind in ('change', 'cancel')
  order by e.event_date, c.created_at;
end;
$function$;

create function public.approve_agent_proposal(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_candidate private.agent_candidates%rowtype;
  v_event public.events%rowtype;
  v_cancelled_at timestamptz;
  v_changes jsonb;
  v_body text;
  v_guest uuid;
begin
  if not private.is_admin() then
    raise exception 'Nur Admins dürfen das.' using errcode = '42501';
  end if;

  select * into v_candidate
  from private.agent_candidates c
  where c.id = p_id and c.kind in ('change', 'cancel') and c.status = 'draft'
  for update;
  if not found then
    raise exception 'Diesen Vorschlag gibt es nicht mehr.' using errcode = 'P0002';
  end if;

  select e.* into v_event
  from public.events e
  where e.id = v_candidate.event_id and e.host_id = private.agent_system_account()
  for update;
  if not found then
    raise exception 'Dieses Event gibt es nicht mehr.' using errcode = 'P0002';
  end if;
  select d.cancelled_at into v_cancelled_at
  from public.agent_event_details d
  where d.event_id = v_event.id
  for update;
  if v_cancelled_at is not null then
    raise exception 'Dieses Event ist schon abgesagt.' using errcode = '22023';
  end if;
  if v_event.event_date <= now() then
    raise exception 'Dieses Event hat schon angefangen.' using errcode = '22023';
  end if;

  if v_candidate.kind = 'change' then
    v_changes := v_candidate.changes;

    -- Nur die genannten Felder, alle Werte aus den geprueften Spalten des Vorschlags.
    update public.events e set
      event_date = case when v_changes ? 'starts_at' then v_candidate.starts_at else e.event_date end,
      ends_at = case when v_changes ? 'ends_at' then v_candidate.ends_at else e.ends_at end,
      location = case when v_changes ? 'location' then v_candidate.location else e.location end,
      lat = case when v_changes ? 'location' then v_candidate.lat else e.lat end,
      lng = case when v_changes ? 'location' then v_candidate.lng else e.lng end,
      price = case when v_changes ? 'price' then v_candidate.price else e.price end
    where e.id = v_event.id;

    begin
      update public.agent_event_details d set
        starts_on = case when v_changes ? 'starts_at' then v_candidate.starts_on else d.starts_on end,
        last_checked_at = now()
      where d.event_id = v_event.id;
    exception when unique_violation then
      raise exception 'An diesem Tag gibt es dieses Event schon.' using errcode = '23505';
    end;

    -- Dieselben Woerter wie im Admin-Screen.
    select 'Geändert: ' || array_to_string(array_remove(array[
      case when v_changes ? 'starts_at'
        and (v_event.event_date at time zone 'Europe/Berlin')::date
          <> (v_candidate.starts_at at time zone 'Europe/Berlin')::date then 'Datum' end,
      case when v_changes ? 'starts_at'
        and (v_event.event_date at time zone 'Europe/Berlin')::time
          <> (v_candidate.starts_at at time zone 'Europe/Berlin')::time then 'Uhrzeit' end,
      case when v_changes ? 'ends_at' then 'Ende' end,
      case when v_changes ? 'location' then 'Ort' end,
      case when v_changes ? 'price' then 'Preis' end
    ], null), ', ') into v_body;
  else
    update public.agent_event_details d
    set cancelled_at = now(), last_checked_at = now()
    where d.event_id = v_event.id;

    -- Eine Aenderung an einer abgesagten Party ist sinnlos.
    update private.agent_candidates c
    set status = 'expired', decided_at = now()
    where c.event_id = v_event.id and c.status = 'draft' and c.kind = 'change';

    v_body := 'Die Party wurde abgesagt';
  end if;

  update private.agent_candidates
  set status = 'approved', decided_at = now()
  where id = p_id;

  -- Push an jeden Gast mit Zusage oder Vielleicht. queue_push faengt seine Fehler selbst;
  -- der Block hier faengt auch ein fehlendes oder kaputtes queue_push.
  for v_guest in
    select r.user_id from public.rsvps r
    where r.event_id = v_event.id and r.status in ('going', 'maybe')
  loop
    begin
      perform private.queue_push(v_guest, v_event.host_id, v_event.id, v_body);
    exception when others then
      raise warning 'proposal push not queued for %: %', v_event.id, sqlerrm;
    end;
  end loop;
end;
$function$;

revoke all on function public.get_agent_proposals() from public, anon;
revoke all on function public.approve_agent_proposal(uuid) from public, anon;
grant execute on function public.get_agent_proposals() to authenticated;
grant execute on function public.approve_agent_proposal(uuid) to authenticated;
