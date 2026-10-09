-- show_pending_requests_in_map_functions
--
-- Rollback: re-apply the three functions from 20261002212231_add_the_map_functions.sql
-- and 20261002212251_add_the_party_detail_functions.sql as CREATE OR REPLACE.
--
-- A pending request has to show on the requester's screens (App Redesign 5.1, 5.3):
-- get_my_parties, get_explore_parties and get_party_detail now return
-- my_status = 'requested' when the user has a request and no RSVP. get_my_parties also
-- lists parties with only a request (it joined rsvps with an INNER JOIN before).
-- Same return shapes, CREATE OR REPLACE, so grants and callers stay. The position, the
-- address and is_exact are untouched: a request gives no access, so has_exact_access
-- stays false and the blurred point is what comes back. The app on main calls none of
-- the three.
--
-- Verified 2026-10-05: return types identical to before; SECURITY DEFINER, search_path
-- empty, authenticated only.

CREATE OR REPLACE FUNCTION public.get_my_parties()
 RETURNS TABLE(id uuid, title text, background_url text, event_date timestamp with time zone, ends_at timestamp with time zone, is_public boolean, host_id uuid, host_firstname text, host_lastname text, host_avatar_url text, host_avatar_color text, lat double precision, lng double precision, is_exact boolean, my_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT
    e.id, e.title, e.background_url, e.event_date, e.ends_at, e.is_public,
    e.host_id, p.firstname,
    private.visible_lastname(p.lastname, private.has_exact_access(e.id, e.is_public)),
    p.avatar_url, p.avatar_color,
    CASE WHEN private.has_exact_access(e.id, e.is_public) THEN e.lat ELSE e.fuzzy_lat END,
    CASE WHEN private.has_exact_access(e.id, e.is_public) THEN e.lng ELSE e.fuzzy_lng END,
    private.has_exact_access(e.id, e.is_public),
    COALESCE(r.status, CASE WHEN jr.user_id IS NOT NULL THEN 'requested' END)
  FROM public.events e
  JOIN public.profiles p ON p.id = e.host_id
  LEFT JOIN public.rsvps r ON r.event_id = e.id AND r.user_id = (SELECT auth.uid())
  LEFT JOIN public.join_requests jr ON jr.event_id = e.id AND jr.user_id = (SELECT auth.uid())
  WHERE (r.user_id IS NOT NULL OR jr.user_id IS NOT NULL)
    AND e.lat IS NOT NULL
    AND private.party_visible_until(e.event_date, e.ends_at) > now()
  ORDER BY e.event_date;
$function$;

CREATE OR REPLACE FUNCTION public.get_explore_parties()
 RETURNS TABLE(id uuid, title text, background_url text, event_date timestamp with time zone, ends_at timestamp with time zone, is_public boolean, host_id uuid, host_firstname text, host_lastname text, host_avatar_url text, host_avatar_color text, lat double precision, lng double precision, is_exact boolean, my_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT
    e.id, e.title, e.background_url, e.event_date, e.ends_at, e.is_public,
    e.host_id, p.firstname,
    private.visible_lastname(p.lastname, private.has_exact_access(e.id, e.is_public)),
    p.avatar_url, p.avatar_color,
    CASE WHEN private.has_exact_access(e.id, e.is_public) THEN e.lat ELSE e.fuzzy_lat END,
    CASE WHEN private.has_exact_access(e.id, e.is_public) THEN e.lng ELSE e.fuzzy_lng END,
    private.has_exact_access(e.id, e.is_public),
    COALESCE(r.status, CASE WHEN jr.user_id IS NOT NULL THEN 'requested' END)
  FROM public.events e
  JOIN public.profiles p ON p.id = e.host_id
  LEFT JOIN public.rsvps r ON r.event_id = e.id AND r.user_id = (SELECT auth.uid())
  LEFT JOIN public.join_requests jr ON jr.event_id = e.id AND jr.user_id = (SELECT auth.uid())
  WHERE e.lat IS NOT NULL
    AND private.party_visible_until(e.event_date, e.ends_at) > now()
  ORDER BY e.event_date;
$function$;

CREATE OR REPLACE FUNCTION public.get_party_detail(p_event_id uuid)
 RETURNS TABLE(id uuid, host_id uuid, host_firstname text, host_lastname text, host_avatar_url text, host_avatar_color text, title text, description text, motto text, dresscode text, event_date timestamp with time zone, ends_at timestamp with time zone, background_url text, max_guests integer, is_public boolean, lat double precision, lng double precision, is_exact boolean, location text, my_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    COALESCE(r.status, CASE WHEN jr.user_id IS NOT NULL THEN 'requested' END)
  FROM public.events e
  JOIN public.profiles p ON p.id = e.host_id
  LEFT JOIN public.rsvps r ON r.event_id = e.id AND r.user_id = (SELECT auth.uid())
  LEFT JOIN public.join_requests jr ON jr.event_id = e.id AND jr.user_id = (SELECT auth.uid())
  WHERE e.id = p_event_id;
$function$;
