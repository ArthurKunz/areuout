-- add_get_party_join_requests
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.get_party_join_requests(uuid);
--
-- The host's card `Anfragen` (App Redesign 6.3): who asked to join, with full name and
-- picture, oldest first. profiles is own-row-only, so the host cannot read the
-- requesters' names any other way. Rows only when the caller is the party's host;
-- everyone else gets none. Reads nothing from events beyond host_id.
--
-- Verified 2026-10-05: SECURITY DEFINER, search_path empty; anon cannot execute it,
-- authenticated can.

CREATE FUNCTION public.get_party_join_requests(p_event_id uuid)
RETURNS TABLE (
  user_id uuid, firstname text, lastname text, avatar_url text, avatar_color text, created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $f$
  SELECT p.id, p.firstname, p.lastname, p.avatar_url, p.avatar_color, jr.created_at
  FROM public.join_requests jr
  JOIN public.profiles p ON p.id = jr.user_id
  JOIN public.events e ON e.id = jr.event_id
  WHERE jr.event_id = p_event_id
    AND e.host_id = (SELECT auth.uid())
  ORDER BY jr.created_at;
$f$;

REVOKE ALL ON FUNCTION public.get_party_join_requests(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_party_join_requests(uuid) TO authenticated;
