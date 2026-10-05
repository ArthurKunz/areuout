-- add_get_party_guest_list
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.get_party_guest_list(uuid);
--
-- The redesign's guest list (App Redesign 3.6): everyone on the party with full name,
-- picture and answer, for every signed-in viewer, a stranger on a private party
-- included. Same rows as get_party_guests, but the last name is never shortened.
-- Returns profile fields and the RSVP status only; reads nothing from events except
-- the host id, so no address, coordinates, invite code or email can appear.
-- get_party_guests stays unchanged.

CREATE FUNCTION public.get_party_guest_list(p_event_id uuid)
RETURNS TABLE (
  user_id uuid, firstname text, lastname text, avatar_url text, avatar_color text, status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $f$
  WITH rows AS (
    SELECT p.id, p.firstname, p.lastname, p.avatar_url, p.avatar_color, r.status
    FROM public.rsvps r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.event_id = p_event_id
    UNION ALL
    SELECT p.id, p.firstname, p.lastname, p.avatar_url, p.avatar_color, 'host'
    FROM public.events e
    JOIN public.profiles p ON p.id = e.host_id
    WHERE e.id = p_event_id
      AND NOT EXISTS (SELECT 1 FROM public.rsvps r WHERE r.event_id = p_event_id AND r.user_id = e.host_id)
  )
  SELECT rows.id, rows.firstname, rows.lastname, rows.avatar_url, rows.avatar_color, rows.status
  FROM rows
  ORDER BY CASE status WHEN 'host' THEN 0 WHEN 'going' THEN 1 WHEN 'maybe' THEN 2 ELSE 3 END, firstname;
$f$;

REVOKE ALL ON FUNCTION public.get_party_guest_list(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_party_guest_list(uuid) TO authenticated;
