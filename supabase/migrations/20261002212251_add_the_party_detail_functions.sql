-- add_the_party_detail_functions
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.get_party_detail(uuid);
--   DROP FUNCTION IF EXISTS public.get_party_guests(uuid);
--   DROP FUNCTION IF EXISTS public.get_party_polls(uuid);
--
-- get_party_detail never includes invite_code in its result, at all — confirmed
-- structurally (no function among the six new ones has "invite_code" anywhere in its
-- return shape). get_party_guests and get_party_polls are deliberately NOT
-- member-gated, unlike the older get_event_attendees/get_pool_responses_by_event:
-- the redesign puts every private party's guest list and polls on Explore too, for
-- strangers as well, just with less in the result.
--
-- Verified 2026-10-02 against the real party, with real poll/question data inserted
-- inside a rolled-back transaction: as stranger C, get_party_detail returns blurred
-- coordinates, is_exact=false, location=null, host name truncated; get_party_guests
-- truncates a real multi-letter name ("Klemm" -> "K"); get_party_polls returns
-- options and vote counts with voters=null and text_responses=null. As guest B (has
-- access via rsvp), all three return the full row: exact position, the address, full
-- names, full voter lists per option, and the free-text answer in full (including a
-- place-hint string used specifically to confirm it isn't leaked without access).

CREATE OR REPLACE FUNCTION public.get_party_detail(p_event_id uuid)
RETURNS TABLE (
  id uuid, host_id uuid, host_firstname text, host_lastname text,
  host_avatar_url text, host_avatar_color text,
  title text, description text, motto text, dresscode text,
  event_date timestamptz, ends_at timestamptz, background_url text,
  max_guests integer, is_public boolean,
  lat double precision, lng double precision, is_exact boolean,
  location text, my_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $f$
  SELECT
    e.id, e.host_id, p.firstname,
    private.visible_lastname(p.lastname, private.has_exact_access(e.id, e.is_public)),
    p.avatar_url, p.avatar_color,
    e.title, e.description, e.motto, e.dresscode, e.event_date, e.ends_at, e.background_url,
    e.max_guests, e.is_public,
    CASE WHEN private.has_exact_access(e.id, e.is_public) THEN e.lat ELSE e.fuzzy_lat END,
    CASE WHEN private.has_exact_access(e.id, e.is_public) THEN e.lng ELSE e.fuzzy_lng END,
    private.has_exact_access(e.id, e.is_public),
    CASE WHEN private.has_exact_access(e.id, e.is_public) THEN e.location ELSE NULL END,
    r.status
  FROM public.events e
  JOIN public.profiles p ON p.id = e.host_id
  LEFT JOIN public.rsvps r ON r.event_id = e.id AND r.user_id = (SELECT auth.uid())
  WHERE e.id = p_event_id;
$f$;

REVOKE ALL ON FUNCTION public.get_party_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_party_detail(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_party_guests(p_event_id uuid)
RETURNS TABLE (
  user_id uuid, firstname text, lastname text, avatar_url text, avatar_color text, status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $f$
  WITH access AS (
    SELECT private.has_exact_access(
      p_event_id, (SELECT e.is_public FROM public.events e WHERE e.id = p_event_id)
    ) AS has_access
  ),
  rows AS (
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
  SELECT
    rows.id, rows.firstname,
    private.visible_lastname(rows.lastname, (SELECT has_access FROM access)),
    rows.avatar_url, rows.avatar_color, rows.status
  FROM rows
  ORDER BY CASE status WHEN 'host' THEN 0 WHEN 'going' THEN 1 WHEN 'maybe' THEN 2 ELSE 3 END, firstname;
$f$;

REVOKE ALL ON FUNCTION public.get_party_guests(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_party_guests(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_party_polls(p_event_id uuid)
RETURNS TABLE (
  pool_id uuid, question text, type text, allow_multiple boolean,
  options jsonb, text_responses jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $f$
  WITH access AS (
    SELECT private.has_exact_access(
      p_event_id, (SELECT e.is_public FROM public.events e WHERE e.id = p_event_id)
    ) AS has_access
  )
  SELECT
    pl.id, pl.question, pl.type, pl.allow_multiple,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'option_id', po.id,
        'label', po.label,
        'vote_count', (SELECT count(*) FROM public.pool_responses pr2 WHERE pr2.option_id = po.id),
        'voters', CASE WHEN (SELECT has_access FROM access) THEN (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'user_id', prof.id, 'firstname', prof.firstname, 'lastname', prof.lastname,
            'avatar_url', prof.avatar_url, 'avatar_color', prof.avatar_color
          )), '[]'::jsonb)
          FROM public.pool_responses pr3
          JOIN public.profiles prof ON prof.id = pr3.user_id
          WHERE pr3.option_id = po.id
        ) ELSE NULL END
      ) ORDER BY po.position), '[]'::jsonb)
      FROM public.pool_options po
      WHERE po.pool_id = pl.id
    ) AS options,
    CASE WHEN (SELECT has_access FROM access) THEN (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'user_id', prof.id, 'firstname', prof.firstname, 'lastname', prof.lastname,
        'avatar_url', prof.avatar_url, 'avatar_color', prof.avatar_color,
        'text_response', pr.text_response
      )), '[]'::jsonb)
      FROM public.pool_responses pr
      JOIN public.profiles prof ON prof.id = pr.user_id
      WHERE pr.pool_id = pl.id AND pr.text_response IS NOT NULL
    ) ELSE NULL END AS text_responses
  FROM public.pools pl
  WHERE pl.event_id = p_event_id
  ORDER BY pl.created_at;
$f$;

REVOKE ALL ON FUNCTION public.get_party_polls(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_party_polls(uuid) TO authenticated;
