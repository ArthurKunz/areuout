-- stop_moving_an_rsvp_to_another_party
--
-- Rollback:
--   DROP TRIGGER IF EXISTS rsvps_keep_party_and_owner ON public.rsvps;
--   DROP FUNCTION IF EXISTS private.keep_rsvp_party_and_owner();
--
-- rsvps_update_own checks that the row is yours, not that it stays on its party, and
-- authenticated holds UPDATE on rsvps.event_id. So an RSVP on any reachable party could
-- be moved onto a private one, which made the mover a member (is_party_member) and
-- handed them the address through events_select_member. This pins event_id and user_id
-- on every update. The client's upsert on (event_id, user_id) writes the same values
-- back and passes.
--
-- Verified 2026-10-05 as a signed-in user (role authenticated, jwt claims set, RLS on),
-- each run rolled back. Before: moving one's own RSVP onto a private party without
-- access succeeded and the party's address became readable. After: moving event_id or
-- user_id fails with 42501 and the party stays invisible; the old app's upsert of the
-- same answer, a plain status change, the host removing a guest and a guest deleting
-- their own RSVP all still work.

CREATE OR REPLACE FUNCTION private.keep_rsvp_party_and_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
begin
  if new.event_id is distinct from old.event_id or new.user_id is distinct from old.user_id then
    raise exception 'An RSVP cannot move to another party or person.'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION private.keep_rsvp_party_and_owner() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER rsvps_keep_party_and_owner
BEFORE UPDATE ON public.rsvps
FOR EACH ROW EXECUTE FUNCTION private.keep_rsvp_party_and_owner();
