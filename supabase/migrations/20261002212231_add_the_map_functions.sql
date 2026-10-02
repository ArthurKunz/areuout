-- add_the_map_functions
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.get_explore_parties();
--   DROP FUNCTION IF EXISTS public.get_my_parties();
--   DROP FUNCTION IF EXISTS public.get_hosting_parties();
--   DROP FUNCTION IF EXISTS private.has_exact_access(uuid, boolean);
--   DROP FUNCTION IF EXISTS private.has_party_access(uuid);
--   DROP FUNCTION IF EXISTS private.visible_lastname(text, boolean);
--
-- private.has_party_access / has_exact_access are the one place the privacy rule
-- lives: host, or a row in rsvps, or a row in private.invite_opens grants access;
-- being public grants exact position to everyone regardless of access. Every
-- function below calls these rather than repeating the check, so it can't drift.
--
-- Verified 2026-10-02 as host A, guest B and stranger C against the real party (with
-- its event_date and coordinates temporarily moved into the future inside a
-- rolled-back transaction, since the real party predates Step 2 and has no
-- coordinates yet): host A sees explore (exact, is_public=false, full own name) and
-- hosting (exact), absent from my_parties (no rsvp to own party). Guest B sees
-- explore and my_parties (exact, full host name, my_status='going'), absent from
-- hosting. Stranger C sees explore only, blurred (is_exact=false, host name truncated
-- to its initial, within 200 m of the true point), absent from my_parties and
-- hosting. A party 25 h past its end returns 0 rows from all three, even for the host.

CREATE OR REPLACE FUNCTION private.has_party_access(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $f$
  SELECT
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event_id AND e.host_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.rsvps r WHERE r.event_id = p_event_id AND r.user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM private.invite_opens io WHERE io.event_id = p_event_id AND io.user_id = (SELECT auth.uid()));
$f$;

REVOKE ALL ON FUNCTION private.has_party_access(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.has_exact_access(p_event_id uuid, p_is_public boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $f$
  SELECT p_is_public OR private.has_party_access(p_event_id);
$f$;

REVOKE ALL ON FUNCTION private.has_exact_access(uuid, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.visible_lastname(p_lastname text, p_has_access boolean)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $f$
  SELECT CASE WHEN p_has_access THEN p_lastname ELSE left(p_lastname, 1) END;
$f$;

REVOKE ALL ON FUNCTION private.visible_lastname(text, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_explore_parties()
RETURNS TABLE (
  id uuid, title text, background_url text, event_date timestamptz, ends_at timestamptz,
  is_public boolean, host_id uuid, host_firstname text, host_lastname text,
  host_avatar_url text, host_avatar_color text,
  lat double precision, lng double precision, is_exact boolean, my_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $f$
  SELECT
    e.id, e.title, e.background_url, e.event_date, e.ends_at, e.is_public,
    e.host_id, p.firstname,
    private.visible_lastname(p.lastname, private.has_exact_access(e.id, e.is_public)),
    p.avatar_url, p.avatar_color,
    CASE WHEN private.has_exact_access(e.id, e.is_public) THEN e.lat ELSE e.fuzzy_lat END,
    CASE WHEN private.has_exact_access(e.id, e.is_public) THEN e.lng ELSE e.fuzzy_lng END,
    private.has_exact_access(e.id, e.is_public),
    r.status
  FROM public.events e
  JOIN public.profiles p ON p.id = e.host_id
  LEFT JOIN public.rsvps r ON r.event_id = e.id AND r.user_id = (SELECT auth.uid())
  WHERE e.lat IS NOT NULL
    AND private.party_visible_until(e.event_date, e.ends_at) > now()
  ORDER BY e.event_date;
$f$;

REVOKE ALL ON FUNCTION public.get_explore_parties() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_explore_parties() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_parties()
RETURNS TABLE (
  id uuid, title text, background_url text, event_date timestamptz, ends_at timestamptz,
  is_public boolean, host_id uuid, host_firstname text, host_lastname text,
  host_avatar_url text, host_avatar_color text,
  lat double precision, lng double precision, is_exact boolean, my_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $f$
  SELECT
    e.id, e.title, e.background_url, e.event_date, e.ends_at, e.is_public,
    e.host_id, p.firstname,
    private.visible_lastname(p.lastname, private.has_exact_access(e.id, e.is_public)),
    p.avatar_url, p.avatar_color,
    CASE WHEN private.has_exact_access(e.id, e.is_public) THEN e.lat ELSE e.fuzzy_lat END,
    CASE WHEN private.has_exact_access(e.id, e.is_public) THEN e.lng ELSE e.fuzzy_lng END,
    private.has_exact_access(e.id, e.is_public),
    r.status
  FROM public.events e
  JOIN public.profiles p ON p.id = e.host_id
  JOIN public.rsvps r ON r.event_id = e.id AND r.user_id = (SELECT auth.uid())
  WHERE e.lat IS NOT NULL
    AND private.party_visible_until(e.event_date, e.ends_at) > now()
  ORDER BY e.event_date;
$f$;

REVOKE ALL ON FUNCTION public.get_my_parties() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_parties() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_hosting_parties()
RETURNS TABLE (
  id uuid, title text, background_url text, event_date timestamptz, ends_at timestamptz,
  is_public boolean, host_id uuid, host_firstname text, host_lastname text,
  host_avatar_url text, host_avatar_color text,
  lat double precision, lng double precision, is_exact boolean, my_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $f$
  SELECT
    e.id, e.title, e.background_url, e.event_date, e.ends_at, e.is_public,
    e.host_id, p.firstname, p.lastname,
    p.avatar_url, p.avatar_color,
    e.lat, e.lng, true,
    r.status
  FROM public.events e
  JOIN public.profiles p ON p.id = e.host_id
  LEFT JOIN public.rsvps r ON r.event_id = e.id AND r.user_id = (SELECT auth.uid())
  WHERE e.lat IS NOT NULL
    AND e.host_id = (SELECT auth.uid())
    AND private.party_visible_until(e.event_date, e.ends_at) > now()
  ORDER BY e.event_date;
$f$;

REVOKE ALL ON FUNCTION public.get_hosting_parties() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_hosting_parties() TO authenticated;
