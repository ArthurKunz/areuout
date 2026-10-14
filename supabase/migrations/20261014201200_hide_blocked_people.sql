-- Blockieren, Teil 3: die Regel in den Funktionen, die die App aufruft (Schritt 13b).
--
-- Einseitig versteckt, fuer den Blockierenden (private.has_blocked(auth.uid(), x)), damit
-- der Blockierte nichts merkt:
--   get_explore_parties, get_my_parties, get_party_detail: keine Party, deren Host man
--     blockiert hat (get_party_detail: 0 Zeilen, wie eine geloeschte Party);
--   get_party_guest_list: keine Zeile einer blockierten Person, 0 Zeilen bei blockiertem
--     Host;
--   get_party_poll_data: keine Antwort und Stimme einer blockierten Person, 0 Zeilen bei
--     blockiertem Host.
-- Die Zaehler in der Datenbank (party_has_room, rsvps_enforce_capacity) bleiben, wie sie
-- sind. Die Oberflaeche zaehlt aus den Zeilen und zeigt dem Blockierenden deshalb einen
-- weniger.
--
-- In beide Richtungen gesperrt (private.is_blocked_between):
--   request_to_join: neutraler Satz, der die Blockierung nicht verraet;
--   can_rsvp_to_event (und damit rsvps_insert_authenticated): keine Zusage, auch nicht
--     auf einer oeffentlichen Party oder per Einladungslink;
--   private.has_party_access: keine Adresse und kein genauer Punkt einer privaten Party
--     des anderen, auch wenn der Blockierte den Link erneut oeffnet und invite_opens neu
--     entsteht. Der Host-Zweig bleibt unveraendert.
--
-- Uebersprungen: get_party_guests ruft die App nicht mehr auf.
--
-- CREATE OR REPLACE, gleiche Signaturen, Rueckgabeformen, SECURITY, search_path und
-- Rechte. Die Ruempfe sind aus pg_get_functiondef der Live-Datenbank uebernommen;
-- geaendert sind nur die Zeilen mit has_blocked und is_blocked_between. Bricht ab, wenn
-- ein Rumpf auf der Datenbank nicht mehr der vom 14.10.2026 ist. Setzt
-- 20261014200517_create_blocks.sql voraus. Alles in einer Transaktion.

begin;

do $$
declare
  v_expected constant jsonb := jsonb_build_object(
    'public.get_explore_parties()', '846538853c48fba8ee78f51b77efb9db',
    'public.get_my_parties()', '156738860a32d8c6b2d30b9eb39a32bf',
    'public.get_party_detail(uuid)', '711bfbc6c7ecb7a2924cc3967b46dbc1',
    'public.get_party_guest_list(uuid)', '2af78b355aa5fdba69c3f6bba5783503',
    'public.get_party_poll_data(uuid)', '0d1bd3eecd545e45bcd11df6549a239e',
    'public.request_to_join(uuid)', '94843a1b3bb2ffecb29675fdf7dd373c',
    'public.can_rsvp_to_event(uuid)', 'a9dd983660ab52237e06ff66da793154',
    'private.has_party_access(uuid)', '0a26f3419c21f10a4bfaf99a94682771'
  );
  v_fn text;
begin
  for v_fn in select jsonb_object_keys(v_expected) loop
    if (select md5(prosrc) from pg_proc where oid = v_fn::regprocedure) <> v_expected ->> v_fn then
      raise exception '% changed since 2026-10-14, compare before applying', v_fn;
    end if;
  end loop;
end;
$$;

CREATE OR REPLACE FUNCTION public.get_explore_parties()
 RETURNS TABLE(id uuid, title text, background_url text, event_date timestamp with time zone, ends_at timestamp with time zone, is_public boolean, host_id uuid, host_firstname text, host_lastname text, host_avatar_url text, host_avatar_color text, lat double precision, lng double precision, is_exact boolean, my_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT
    e.id, e.title, e.background_url, e.event_date, e.ends_at, e.is_public,
    e.host_id, p.firstname, p.lastname,
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
    AND NOT private.has_blocked((SELECT auth.uid()), e.host_id)
  ORDER BY e.event_date;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_parties()
 RETURNS TABLE(id uuid, title text, background_url text, event_date timestamp with time zone, ends_at timestamp with time zone, is_public boolean, host_id uuid, host_firstname text, host_lastname text, host_avatar_url text, host_avatar_color text, lat double precision, lng double precision, is_exact boolean, my_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT
    e.id, e.title, e.background_url, e.event_date, e.ends_at, e.is_public,
    e.host_id, p.firstname, p.lastname,
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
    AND NOT private.has_blocked((SELECT auth.uid()), e.host_id)
  ORDER BY e.event_date;
$function$;

CREATE OR REPLACE FUNCTION public.get_party_detail(p_event_id uuid)
 RETURNS TABLE(id uuid, host_id uuid, host_firstname text, host_lastname text, host_avatar_url text, host_avatar_color text, title text, description text, motto text, dresscode text, event_date timestamp with time zone, ends_at timestamp with time zone, background_url text, max_guests integer, price numeric, is_public boolean, lat double precision, lng double precision, is_exact boolean, location text, my_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT
    e.id, e.host_id, p.firstname, p.lastname,
    p.avatar_url, p.avatar_color,
    e.title, e.description, e.motto, e.dresscode, e.event_date, e.ends_at, e.background_url,
    e.max_guests, e.price, e.is_public,
    CASE WHEN x.exact THEN e.lat ELSE e.fuzzy_lat END,
    CASE WHEN x.exact THEN e.lng ELSE e.fuzzy_lng END,
    x.exact,
    CASE WHEN x.exact THEN e.location ELSE NULL END,
    COALESCE(r.status, CASE WHEN jr.user_id IS NOT NULL THEN 'requested' END)
  FROM public.events e
  JOIN public.profiles p ON p.id = e.host_id
  CROSS JOIN LATERAL (
    SELECT private.has_exact_access(e.id, e.is_public)
       AND (e.host_id = (SELECT auth.uid())
            OR private.party_visible_until(e.event_date, e.ends_at) > now()) AS exact
  ) x
  LEFT JOIN public.rsvps r ON r.event_id = e.id AND r.user_id = (SELECT auth.uid())
  LEFT JOIN public.join_requests jr ON jr.event_id = e.id AND jr.user_id = (SELECT auth.uid())
  WHERE e.id = p_event_id
    AND NOT private.has_blocked((SELECT auth.uid()), e.host_id);
$function$;

CREATE OR REPLACE FUNCTION public.get_party_guest_list(p_event_id uuid)
 RETURNS TABLE(user_id uuid, firstname text, lastname text, avatar_url text, avatar_color text, status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  WHERE NOT private.has_blocked((SELECT auth.uid()), rows.id)
    AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event_id AND private.has_blocked((SELECT auth.uid()), e.host_id))
  ORDER BY CASE status WHEN 'host' THEN 0 WHEN 'going' THEN 1 WHEN 'maybe' THEN 2 ELSE 3 END, firstname;
$function$;

CREATE OR REPLACE FUNCTION public.get_party_poll_data(p_event_id uuid)
 RETURNS TABLE(pool_id uuid, question text, type text, allow_multiple boolean, options jsonb, responses jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
     WHERE pr.pool_id = pl.id
       AND NOT private.has_blocked((SELECT auth.uid()), pr.user_id))
  FROM public.pools pl
  JOIN public.events e ON e.id = pl.event_id
  WHERE pl.event_id = p_event_id
    AND (e.is_public OR public.is_party_member(p_event_id))
    AND NOT private.has_blocked((SELECT auth.uid()), e.host_id)
  ORDER BY pl.created_at;
$function$;

CREATE OR REPLACE FUNCTION public.request_to_join(p_event_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_is_public boolean;
  v_host_id uuid;
  v_event_date timestamptz;
  v_ends_at timestamptz;
begin
  select e.is_public, e.host_id, e.event_date, e.ends_at
    into v_is_public, v_host_id, v_event_date, v_ends_at
  from public.events e
  where e.id = p_event_id;

  if not found then
    raise exception 'Diese Party gibt es nicht mehr.' using errcode = 'P0002';
  end if;

  -- The capacity trigger's lock on the party, then one per person, so two requests
  -- in parallel can neither overfill a party nor slip past the limit of 10.
  perform pg_advisory_xact_lock(hashtext(p_event_id::text));
  perform pg_advisory_xact_lock(hashtext('join_requests:' || v_uid::text));

  if v_is_public then
    raise exception 'Diese Party ist öffentlich. Du kannst direkt teilnehmen.' using errcode = 'P0001';
  end if;

  if v_host_id = v_uid then
    raise exception 'Das ist deine eigene Party.' using errcode = 'P0001';
  end if;

  -- Neutral on purpose: a blocked person must not learn about the block.
  if private.is_blocked_between(v_uid, v_host_id) then
    raise exception 'Diese Party kannst du gerade nicht anfragen.' using errcode = 'P0001';
  end if;

  if private.has_party_access(p_event_id) then
    raise exception 'Du hast schon Zugang zu dieser Party.' using errcode = 'P0001';
  end if;

  if now() >= private.party_visible_until(v_event_date, v_ends_at) then
    raise exception 'Diese Party ist schon vorbei.' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.join_requests jr where jr.event_id = p_event_id and jr.user_id = v_uid) then
    raise exception 'Du hast diese Party schon angefragt.' using errcode = '23505';
  end if;

  if not public.party_has_room(p_event_id, v_uid) then
    raise exception 'Diese Party ist voll.' using errcode = 'check_violation';
  end if;

  -- Only requests to parties still before their cutoff count; older ones fall away
  -- with the 24-hour rule, without a cleanup job.
  if (
    select count(*)
    from public.join_requests jr
    join public.events e on e.id = jr.event_id
    where jr.user_id = v_uid
      and private.party_visible_until(e.event_date, e.ends_at) > now()
  ) >= 10 then
    raise exception 'Du hast schon 10 offene Anfragen. Warte, bis ein Host antwortet.' using errcode = 'P0001';
  end if;

  insert into public.join_requests (event_id, user_id) values (p_event_id, v_uid);
end;
$function$;

CREATE OR REPLACE FUNCTION public.can_rsvp_to_event(p_event_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT
    NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event_id AND private.is_blocked_between(e.host_id, (SELECT auth.uid())))
    AND (
      EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event_id AND e.is_public)
      OR EXISTS (SELECT 1 FROM public.rsvps r WHERE r.event_id = p_event_id AND r.user_id = (SELECT auth.uid()))
      OR EXISTS (SELECT 1 FROM private.invite_opens io WHERE io.event_id = p_event_id AND io.user_id = (SELECT auth.uid()))
    );
$function$;

CREATE OR REPLACE FUNCTION private.has_party_access(p_event_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event_id AND e.host_id = (SELECT auth.uid()))
    OR (
      NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event_id AND private.is_blocked_between(e.host_id, (SELECT auth.uid())))
      AND (
        EXISTS (SELECT 1 FROM public.rsvps r WHERE r.event_id = p_event_id AND r.user_id = (SELECT auth.uid()))
        OR EXISTS (SELECT 1 FROM private.invite_opens io WHERE io.event_id = p_event_id AND io.user_id = (SELECT auth.uid()))
      )
    );
$function$;

commit;
