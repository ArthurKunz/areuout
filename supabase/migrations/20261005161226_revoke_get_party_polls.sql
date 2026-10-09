-- revoke_get_party_polls
--
-- Rollback:
--   GRANT EXECUTE ON FUNCTION public.get_party_polls(uuid) TO authenticated;
--
-- Called directly, get_party_polls hands a stranger the questions, options and vote
-- counts of a private party. The redesign reads get_party_poll_data instead (Step 7),
-- and nothing calls this one any more; the production app on main never did. The
-- function itself and its body stay.

REVOKE EXECUTE ON FUNCTION public.get_party_polls(uuid) FROM authenticated;
