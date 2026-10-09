-- add_get_party_poll_data
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.get_party_poll_data(uuid);
--
-- Polls and questions with their options, votes and answers for the redesign's
-- detail. Public party: full data for every signed-in user. Private party: full data
-- for members (host or RSVP row) only, no rows for anyone else — including someone
-- who only opened the invite link. The visibility is decided here, not on the screen.
-- Returns pool, option and profile fields only; reads nothing from events except
-- is_public, so no address, coordinates, invite code or email can appear.
-- get_party_polls and get_pool_responses_by_event stay unchanged.

CREATE FUNCTION public.get_party_poll_data(p_event_id uuid)
RETURNS TABLE (
  pool_id uuid, question text, type text, allow_multiple boolean,
  options jsonb,
  responses jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $f$
  SELECT
    pl.id, pl.question, pl.type, pl.allow_multiple,
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('option_id', po.id, 'label', po.label)
       ORDER BY po.position), '[]'::jsonb)
     FROM public.pool_options po WHERE po.pool_id = pl.id),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'option_id', pr.option_id, 'user_id', prof.id,
        'firstname', prof.firstname, 'lastname', prof.lastname,
        'avatar_url', prof.avatar_url, 'avatar_color', prof.avatar_color,
        'text_response', pr.text_response
      ) ORDER BY pr.created_at), '[]'::jsonb)
     FROM public.pool_responses pr
     JOIN public.profiles prof ON prof.id = pr.user_id
     WHERE pr.pool_id = pl.id)
  FROM public.pools pl
  JOIN public.events e ON e.id = pl.event_id
  WHERE pl.event_id = p_event_id
    AND (e.is_public OR public.is_party_member(p_event_id))
  ORDER BY pl.created_at;
$f$;

REVOKE ALL ON FUNCTION public.get_party_poll_data(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_party_poll_data(uuid) TO authenticated;
