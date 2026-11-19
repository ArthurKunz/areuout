-- Party Agent, Schritt 5: Agent-Events in der App und die Entfernung auf Wunsch des
-- Veranstalters.
--
-- - get_agent_event_details(event_id) gibt zusaetzlich going_count zurueck: die Zahl der
--   Zusagen. Die Zaehlfunktionen (get_rsvp_counts_by_status) antworten nur Mitgliedern,
--   ein Fremder sah also 0. Namen gibt es weiterhin nirgends (Schritt 2). Gleiche Regeln
--   wie bisher: nur oeffentliche, noch sichtbare Agent-Events, nur fuer Angemeldete.
-- - Trigger reports_push_organizer: eine Meldung mit Grund 'organizer' auf einem
--   Agent-Event schickt Arthur eine Push (private.queue_admin_push, oeffnet /admin). Nur
--   der Titel der Party, kein Name (CLAUDE.md). Fehler werden in queue_admin_push zur
--   Warnung, die Meldung wird immer gespeichert. Die E-Mail (reports_email_new) bleibt.
-- - Drei Admin-Funktionen, alle pruefen zuerst private.is_admin() (42501 sonst):
--   get_agent_reports() listet offene Veranstalter-Meldungen je Agent-Event,
--   remove_agent_event(id) sperrt die Quelle und loescht das Event, keep_agent_event(id)
--   setzt die Meldungen auf 'handled' und laesst das Event stehen.
--
-- Wichtig zu remove_agent_event: agent_candidates.event_id loescht per Cascade mit, also
-- vergaesse der Agent die Quelle mit dem Event. Deshalb kommt die Quelle zuerst nach
-- private.agent_blocked_sources; party-agent ueberspringt gesperrte Quellen.
--
-- Rollback: supabase/rollbacks/20261114184640_add_agent_display.sql

drop function public.get_agent_event_details(uuid);

create function public.get_agent_event_details(p_event_id uuid)
 returns table (source_url text, organizer_name text, cancelled_at timestamptz, going_count integer)
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select d.source_url, d.organizer_name, d.cancelled_at,
    (select count(*)::integer from public.rsvps r where r.event_id = d.event_id and r.status = 'going')
  from public.agent_event_details d
  join public.events e on e.id = d.event_id
  where d.event_id = p_event_id
    and e.is_public
    and e.host_id = private.agent_system_account()
    and private.party_visible_until(e.event_date, e.ends_at) > now()
    and (select auth.uid()) is not null;
$function$;

revoke all on function public.get_agent_event_details(uuid) from public, anon;
grant execute on function public.get_agent_event_details(uuid) to authenticated;

create function private.push_organizer_report()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_title text;
begin
  select e.title into v_title
  from public.events e
  where e.id = new.event_id and e.host_id = private.agent_system_account();
  if v_title is not null then
    perform private.queue_admin_push('Veranstalter-Meldung: ' || v_title);
  end if;
  return null;
end;
$function$;

revoke all on function private.push_organizer_report() from public, anon, authenticated;

create trigger reports_push_organizer
  after insert on public.reports
  for each row
  when (new.reason = 'organizer' and new.kind = 'party')
  execute function private.push_organizer_report();

create function public.get_agent_reports()
 returns table (event_id uuid, title text, event_date timestamptz, source_url text, report_count integer)
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
begin
  if not private.is_admin() then
    raise exception 'Nur Admins dürfen das.' using errcode = '42501';
  end if;

  return query
  select e.id, e.title, e.event_date, d.source_url, count(*)::integer
  from public.reports r
  join public.events e on e.id = r.event_id
  join public.agent_event_details d on d.event_id = e.id
  where r.kind = 'party'
    and r.reason = 'organizer'
    and r.status = 'open'
    and e.host_id = private.agent_system_account()
  group by e.id, e.title, e.event_date, d.source_url
  order by min(r.created_at);
end;
$function$;

create function public.remove_agent_event(p_event_id uuid)
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

  -- Details, RSVPs, Meldungen und der freigegebene Entwurf gehen per Cascade mit.
  delete from public.events e where e.id = p_event_id;
end;
$function$;

create function public.keep_agent_event(p_event_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if not private.is_admin() then
    raise exception 'Nur Admins dürfen das.' using errcode = '42501';
  end if;

  update public.reports r
  set status = 'handled'
  where r.event_id = p_event_id
    and r.kind = 'party'
    and r.reason = 'organizer'
    and r.status = 'open';
end;
$function$;

revoke all on function public.get_agent_reports() from public, anon;
revoke all on function public.remove_agent_event(uuid) from public, anon;
revoke all on function public.keep_agent_event(uuid) from public, anon;
grant execute on function public.get_agent_reports() to authenticated;
grant execute on function public.remove_agent_event(uuid) to authenticated;
grant execute on function public.keep_agent_event(uuid) to authenticated;
