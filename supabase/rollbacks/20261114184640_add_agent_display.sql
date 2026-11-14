-- Rollback zu supabase/migrations/20261114184640_add_agent_display.sql.
-- Erst die App ohne Gaestezahl und ohne Meldungen im Admin-Screen ausliefern. Gesperrte
-- Quellen bleiben gesperrt, entfernte Events bleiben geloescht.

begin;

drop function public.keep_agent_event(uuid);
drop function public.remove_agent_event(uuid);
drop function public.get_agent_reports();
drop trigger reports_push_organizer on public.reports;
drop function private.push_organizer_report();

drop function public.get_agent_event_details(uuid);
create function public.get_agent_event_details(p_event_id uuid)
 returns table (source_url text, organizer_name text, cancelled_at timestamptz)
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select d.source_url, d.organizer_name, d.cancelled_at
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

commit;
