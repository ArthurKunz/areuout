-- Party Agent, Schritt 5 (Fix nach dem Test): remove_agent_event verwirft auch die offenen
-- Entwuerfe derselben Quelle.
--
-- Gefunden im Test am 14.11.2026: Halfway (prinz.de) wurde entfernt und gesperrt, ein
-- aelterer Entwurf derselben Seite fuer einen anderen Termin stand aber weiter im
-- Admin-Screen. Die Sperre wirkte nur auf kuenftige Laeufe. Jetzt setzt die Entfernung
-- auch diese Entwuerfe auf 'discarded'.
--
-- Bekannte Luecke (geparkt, Build Order "Parking lot"): dasselbe Event ueber eine andere
-- Seite kommt weiter als Entwurf, weil die Sperre am Link haengt, nicht am Event.
--
-- Rollback: supabase/rollbacks/20261114191338_discard_drafts_of_removed_source.sql

create or replace function public.remove_agent_event(p_event_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_source text;
begin
  if not private.is_admin() then
    raise exception 'Nur Admins dürfen das.' using errcode = '42501';
  end if;

  select d.source_url into v_source
  from public.agent_event_details d
  join public.events e on e.id = d.event_id
  where d.event_id = p_event_id and e.host_id = private.agent_system_account()
  for update of e;
  if not found then
    raise exception 'Dieses Event gibt es nicht mehr.' using errcode = 'P0002';
  end if;

  insert into private.agent_blocked_sources (source_url, reason)
  values (v_source, 'organizer_request')
  on conflict (source_url) do nothing;

  -- Offene Entwuerfe derselben Seite (andere Termine) verlassen den Admin-Screen.
  update private.agent_candidates c
  set status = 'discarded', decided_at = now()
  where c.source_url = v_source and c.status = 'draft';

  -- Details, RSVPs, Meldungen und der freigegebene Entwurf gehen per Cascade mit.
  delete from public.events e where e.id = p_event_id;
end;
$function$;
