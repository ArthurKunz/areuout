-- Den Einladungscode bekommt nur noch der Host (Final Review von Schritt 12, Befund A2).
--
-- Bisher las die App den Code als Host direkt aus events. Dieselbe Spalte konnte aber
-- jeder Gast lesen: events_select_member gibt Host und jedem mit RSVP die Zeile, und
-- der Spalten-Grant aus 20261009173733_hide_the_address_columns_of_events.sql enthielt
-- invite_code. Spaltenrechte gelten pro Rolle, nicht pro Zeile. Deshalb diese Funktion
-- fuer den Host, und danach (eigene Migration, erst wenn die App sie nutzt) das
-- Entziehen von SELECT (invite_code) fuer authenticated.
--
-- SECURITY DEFINER mit search_path '', liest nur die eigene Party des Aufrufers. anon
-- bekommt sie ausdruecklich nicht: neue Funktionen in public sind per Default-Privileges
-- fuer anon ausfuehrbar.
--
-- Additiv und fuer main unschaedlich.

create or replace function public.get_party_invite_code(p_event_id uuid)
 returns text
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select e.invite_code
  from public.events e
  where e.id = p_event_id
    and e.host_id = (select auth.uid());
$function$;

revoke all on function public.get_party_invite_code(uuid) from public, anon;
grant execute on function public.get_party_invite_code(uuid) to authenticated;
