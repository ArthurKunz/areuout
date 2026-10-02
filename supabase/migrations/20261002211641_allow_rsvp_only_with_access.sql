-- allow_rsvp_only_with_access
--
-- The one declared behaviour change in Step 2: RSVP without the invite link on a
-- private party is refused for users with no other access (host, existing RSVP,
-- or a row in private.invite_opens).
--
-- Rollback:
--   BEGIN;
--   DROP POLICY rsvps_insert_authenticated ON rsvps;
--   CREATE POLICY rsvps_insert_authenticated ON public.rsvps AS PERMISSIVE FOR INSERT TO authenticated
--     WITH CHECK (((user_id = auth.uid()) AND (NOT (EXISTS ( SELECT 1
--      FROM events e
--     WHERE ((e.id = rsvps.event_id) AND (e.host_id = auth.uid()))))) AND ((status <> 'going'::text) OR party_has_room(event_id, auth.uid()))));
--   DROP FUNCTION IF EXISTS public.can_rsvp_to_event(uuid);
--   COMMIT;
--
-- Why a SECURITY DEFINER helper, not an inline subquery on events/private.invite_opens:
-- the policy expression runs with the CALLER's privileges, not the definer's. A direct
-- EXISTS (SELECT 1 FROM events e WHERE e.id = ... AND e.is_public) inside the policy
-- would be filtered by events_select_member, which has no is_public branch — a stranger
-- could never see the row, so RSVP-without-link on a PUBLIC party would wrongly be
-- refused too. And authenticated holds no USAGE on the private schema, so a direct
-- read of private.invite_opens from inside the policy would make every RSVP insert
-- error with "permission denied for schema private". The function bypasses both,
-- exactly like the existing party_has_room.
--
-- Verified 2026-10-02 in a rolled-back transaction, byte-identical logic to this file:
-- 6 cases (private/no access refused, private/invite_opens accepted, public accepted,
-- existing guest upsert accepted, host refused, private/not_going without access
-- refused) all PASS with sqlstate 42501 on every refusal.

BEGIN;

CREATE OR REPLACE FUNCTION public.can_rsvp_to_event(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $f$
  SELECT
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event_id AND e.is_public)
    OR EXISTS (SELECT 1 FROM public.rsvps r WHERE r.event_id = p_event_id AND r.user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM private.invite_opens io WHERE io.event_id = p_event_id AND io.user_id = (SELECT auth.uid()));
$f$;

REVOKE ALL ON FUNCTION public.can_rsvp_to_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_rsvp_to_event(uuid) TO authenticated;

DROP POLICY rsvps_insert_authenticated ON rsvps;

CREATE POLICY rsvps_insert_authenticated ON public.rsvps AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = (SELECT auth.uid()))
    AND NOT EXISTS (
      SELECT 1 FROM events e WHERE e.id = rsvps.event_id AND e.host_id = (SELECT auth.uid())
    )
    AND (status <> 'going' OR party_has_room(event_id, (SELECT auth.uid())))
    AND can_rsvp_to_event(event_id)
  );

COMMIT;
