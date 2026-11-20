-- Native Redesign, Schritt 0 (Arthur, 2026-11-20, alle vier freigegeben): vier neue Felder
-- an einer Party für die native iOS-App. Vault: 02 Projects/areuout/Native Redesign.md und
-- Native Build Order.md.
--
--   M1 Kategorie: category (house, club, open_air, festival, other) und category_other, der
--      Freitext zu 'Etwas anderes'. In der Datenbank optional, weil die Web-App und die
--      App-Store-App 1.0 die Kategorie nicht kennen und alte Partys keine haben. Die native
--      App macht sie zur Pflicht.
--   M2 Ganztägig: is_all_day. Nur für die Anzeige. Die App setzt event_date auf den
--      Tagesanfang und ends_at auf das Tagesende, dann greift party_visible_until wie immer
--      (24 Stunden nach dem Ende).
--   M3 Preis 0: erlaubt, die App zeigt dafür 'Kostenlos'. Höchstens 2 Nachkommastellen.
--      Bisher war 0 bewusst verboten ("0 is not a second way of saying that", draft.ts);
--      die Web-App schickt weiter nie 0.
--   M4 Website-Titel: website_title, nur zusammen mit website_url. Kein Spaltenrecht, wie
--      website_url (20261119152029): gelesen nur über get_party_detail, an die Adresse
--      gebunden.
--
-- Rückwärtskompatibel: create_party und update_party bekommen vier neue letzte Parameter mit
-- DEFAULT NULL, die Lese-Funktionen neue letzte Spalten. Web-App und App-Store-App rufen die
-- Funktionen ohne die neuen Parameter auf und lesen die neuen Spalten nicht. update_party
-- behält bei NULL den alten Wert.

-- 0. Spalten und Constraints.
alter table public.events add column category text;
alter table public.events add constraint events_category_check
  check (category is null or category in ('house', 'club', 'open_air', 'festival', 'other'));
alter table public.events add column category_other text;
alter table public.events add constraint events_category_other_check
  check ((category is not distinct from 'other') = (category_other is not null)
         and (category_other is null or char_length(btrim(category_other)) between 1 and 20));
alter table public.events add column is_all_day boolean not null default false;
alter table public.events add column website_title text;
alter table public.events add constraint events_website_title_check
  check (website_title is null
         or (char_length(btrim(website_title)) between 1 and 40 and website_url is not null));
alter table public.events drop constraint events_price_check;
alter table public.events add constraint events_price_check
  check (price is null or (price >= 0 and price <= 9999.99 and price = round(price, 2)));
-- SELECT ist pro Spalte vergeben (SCHEMA.md 2). website_title bewusst ohne Recht.
grant select (category, category_other, is_all_day) on public.events to authenticated;

-- 1. Listen (Explore, Going, Hosting): neue letzte Spalten category, category_other, is_all_day.
drop function if exists public.get_explore_parties();
CREATE FUNCTION public.get_explore_parties()
 RETURNS TABLE(id uuid, title text, background_url text, event_date timestamp with time zone, ends_at timestamp with time zone, is_public boolean, host_id uuid, host_firstname text, host_lastname text, host_avatar_url text, host_avatar_color text, lat double precision, lng double precision, is_exact boolean, my_status text, category text, category_other text, is_all_day boolean)
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
    COALESCE(r.status, CASE WHEN jr.user_id IS NOT NULL THEN 'requested' END),
    e.category, e.category_other, e.is_all_day
  FROM public.events e
  JOIN public.profiles p ON p.id = e.host_id
  LEFT JOIN public.rsvps r ON r.event_id = e.id AND r.user_id = (SELECT auth.uid())
  LEFT JOIN public.join_requests jr ON jr.event_id = e.id AND jr.user_id = (SELECT auth.uid())
  WHERE e.lat IS NOT NULL
    AND private.party_visible_until(e.event_date, e.ends_at) > now()
    AND NOT private.has_blocked((SELECT auth.uid()), e.host_id)
  ORDER BY e.event_date;
$function$;
alter function public.get_explore_parties() owner to postgres;
revoke all on function public.get_explore_parties() from public, anon;
grant execute on function public.get_explore_parties() to authenticated, service_role;

drop function if exists public.get_my_parties();
CREATE FUNCTION public.get_my_parties()
 RETURNS TABLE(id uuid, title text, background_url text, event_date timestamp with time zone, ends_at timestamp with time zone, is_public boolean, host_id uuid, host_firstname text, host_lastname text, host_avatar_url text, host_avatar_color text, lat double precision, lng double precision, is_exact boolean, my_status text, category text, category_other text, is_all_day boolean)
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
    COALESCE(r.status, CASE WHEN jr.user_id IS NOT NULL THEN 'requested' END),
    e.category, e.category_other, e.is_all_day
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
alter function public.get_my_parties() owner to postgres;
revoke all on function public.get_my_parties() from public, anon;
grant execute on function public.get_my_parties() to authenticated, service_role;

drop function if exists public.get_hosting_parties();
CREATE FUNCTION public.get_hosting_parties()
 RETURNS TABLE(id uuid, title text, background_url text, event_date timestamp with time zone, ends_at timestamp with time zone, is_public boolean, host_id uuid, host_firstname text, host_lastname text, host_avatar_url text, host_avatar_color text, lat double precision, lng double precision, is_exact boolean, my_status text, category text, category_other text, is_all_day boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT
    e.id, e.title, e.background_url, e.event_date, e.ends_at, e.is_public,
    e.host_id, p.firstname, p.lastname,
    p.avatar_url, p.avatar_color,
    e.lat, e.lng, true,
    r.status,
    e.category, e.category_other, e.is_all_day
  FROM public.events e
  JOIN public.profiles p ON p.id = e.host_id
  LEFT JOIN public.rsvps r ON r.event_id = e.id AND r.user_id = (SELECT auth.uid())
  WHERE e.lat IS NOT NULL
    AND e.host_id = (SELECT auth.uid())
    AND private.party_visible_until(e.event_date, e.ends_at) > now()
  ORDER BY e.event_date;
$function$;
alter function public.get_hosting_parties() owner to postgres;
revoke all on function public.get_hosting_parties() from public, anon;
grant execute on function public.get_hosting_parties() to authenticated, service_role;

-- 2. get_party_detail: dazu website_title, nur mit Adresse (wie website_url).
drop function if exists public.get_party_detail(uuid);
CREATE FUNCTION public.get_party_detail(p_event_id uuid)
 RETURNS TABLE(id uuid, host_id uuid, host_firstname text, host_lastname text, host_avatar_url text, host_avatar_color text, title text, description text, motto text, dresscode text, event_date timestamp with time zone, ends_at timestamp with time zone, background_url text, max_guests integer, price numeric, is_public boolean, lat double precision, lng double precision, is_exact boolean, location text, my_status text, website_url text, organizer_name text, category text, category_other text, is_all_day boolean, website_title text)
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
    COALESCE(r.status, CASE WHEN jr.user_id IS NOT NULL THEN 'requested' END),
    CASE WHEN x.exact THEN e.website_url ELSE NULL END,
    e.organizer_name,
    e.category, e.category_other, e.is_all_day,
    CASE WHEN x.exact THEN e.website_title ELSE NULL END
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
alter function public.get_party_detail(uuid) owner to postgres;
revoke all on function public.get_party_detail(uuid) from public, anon;
grant execute on function public.get_party_detail(uuid) to authenticated, service_role;

-- 3. create_party / update_party: neue Parameter p_category, p_category_other, p_is_all_day,
--    p_website_title (DEFAULT NULL). Preis 0 erlaubt.
drop function if exists public.create_party(p_id uuid, p_title text, p_is_public boolean, p_event_date timestamp with time zone, p_ends_at timestamp with time zone, p_location text, p_lat double precision, p_lng double precision, p_background_url text, p_invite_code text, p_description text, p_motto text, p_dresscode text, p_max_guests integer, p_polls jsonb, p_questions jsonb, p_price numeric, p_website_url text, p_organizer_name text);
CREATE FUNCTION public.create_party(p_id uuid, p_title text, p_is_public boolean, p_event_date timestamp with time zone, p_ends_at timestamp with time zone, p_location text, p_lat double precision, p_lng double precision, p_background_url text, p_invite_code text, p_description text, p_motto text, p_dresscode text, p_max_guests integer, p_polls jsonb, p_questions jsonb, p_price numeric DEFAULT NULL::numeric, p_website_url text DEFAULT NULL::text, p_organizer_name text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_category_other text DEFAULT NULL::text, p_is_all_day boolean DEFAULT NULL::boolean, p_website_title text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_host uuid := auth.uid();
  v_polls jsonb := coalesce(p_polls, '[]'::jsonb);
  v_questions jsonb := coalesce(p_questions, '[]'::jsonb);
  v_poll jsonb;
  v_option jsonb;
  v_question jsonb;
  v_pool_id uuid;
  v_pos integer;
begin
  if v_host is null then
    raise exception 'create_party: not signed in' using errcode = '42501';
  end if;

  -- Validate everything before the first insert.
  if p_title is null or length(btrim(p_title)) not between 1 and 20 then
    raise exception 'Title must be 1 to 20 characters' using errcode = 'check_violation';
  end if;
  if p_motto is not null and length(btrim(p_motto)) not between 1 and 20 then
    raise exception 'Motto must be 1 to 20 characters' using errcode = 'check_violation';
  end if;
  if p_dresscode is not null and length(btrim(p_dresscode)) not between 1 and 20 then
    raise exception 'Dresscode must be 1 to 20 characters' using errcode = 'check_violation';
  end if;
  if p_description is not null and length(p_description) > 500 then
    raise exception 'Description must be at most 500 characters' using errcode = 'check_violation';
  end if;
  if p_max_guests is not null and p_max_guests not between 1 and 500 then
    raise exception 'Max guests must be between 1 and 500' using errcode = 'check_violation';
  end if;
  if p_location is null or btrim(p_location) = '' then
    raise exception 'Location is required' using errcode = 'check_violation';
  end if;
  if p_lat is null or p_lng is null then
    raise exception 'Coordinates are required' using errcode = 'check_violation';
  end if;
  if p_background_url is null then
    raise exception 'Background picture is required' using errcode = 'check_violation';
  end if;
  if p_ends_at is not null and p_ends_at <= p_event_date then
    raise exception 'End must be after start' using errcode = 'check_violation';
  end if;
  if p_ends_at is not null and p_ends_at > p_event_date + interval '30 days' then
    raise exception 'End must be at most 30 days after start' using errcode = 'check_violation';
  end if;
  if p_price is not null and (p_price < 0 or p_price > 9999.99 or p_price <> round(p_price, 2)) then
    raise exception 'Price must be between 0 and 9999.99, at most 2 decimals' using errcode = 'check_violation';
  end if;
  if nullif(btrim(p_organizer_name), '') is not null and length(btrim(p_organizer_name)) > 40 then
    raise exception 'Organizer must be at most 40 characters' using errcode = 'check_violation';
  end if;
  if p_category is not null and p_category not in ('house', 'club', 'open_air', 'festival', 'other') then
    raise exception 'Unknown category' using errcode = 'check_violation';
  end if;
  if p_category = 'other' and (p_category_other is null or length(btrim(p_category_other)) not between 1 and 20) then
    raise exception 'Other category must be 1 to 20 characters' using errcode = 'check_violation';
  end if;
  if nullif(btrim(p_website_title), '') is not null and length(btrim(p_website_title)) > 40 then
    raise exception 'Website title must be at most 40 characters' using errcode = 'check_violation';
  end if;

  if jsonb_typeof(v_polls) <> 'array' then
    raise exception 'Polls must be a list' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(v_polls) > 5 then
    raise exception 'At most 5 polls' using errcode = 'check_violation';
  end if;
  for v_poll in select value from jsonb_array_elements(v_polls) loop
    if jsonb_typeof(v_poll) <> 'object'
       or jsonb_typeof(v_poll->'question') is distinct from 'string'
       or jsonb_typeof(v_poll->'options') is distinct from 'array'
       or jsonb_typeof(v_poll->'allow_multiple') not in ('boolean', 'null') then
      raise exception 'Each poll needs a question, options and allow_multiple' using errcode = 'check_violation';
    end if;
    if length(btrim(v_poll->>'question')) not between 1 and 60 then
      raise exception 'Poll question must be 1 to 60 characters' using errcode = 'check_violation';
    end if;
    if jsonb_array_length(v_poll->'options') not between 2 and 10 then
      raise exception 'A poll needs 2 to 10 options' using errcode = 'check_violation';
    end if;
    for v_option in select value from jsonb_array_elements(v_poll->'options') loop
      if jsonb_typeof(v_option) <> 'string' or length(btrim(v_option #>> '{}')) not between 1 and 30 then
        raise exception 'Poll option must be 1 to 30 characters' using errcode = 'check_violation';
      end if;
    end loop;
  end loop;

  if jsonb_typeof(v_questions) <> 'array' then
    raise exception 'Questions must be a list' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(v_questions) > 5 then
    raise exception 'At most 5 questions' using errcode = 'check_violation';
  end if;
  for v_question in select value from jsonb_array_elements(v_questions) loop
    if jsonb_typeof(v_question) <> 'string' or length(btrim(v_question #>> '{}')) not between 1 and 60 then
      raise exception 'Question must be 1 to 60 characters' using errcode = 'check_violation';
    end if;
  end loop;

  insert into public.events (
    id, host_id, title, is_public, event_date, ends_at, location, lat, lng,
    background_url, invite_code, description, motto, dresscode, max_guests, price, website_url, organizer_name,
    category, category_other, is_all_day, website_title
  ) values (
    p_id, v_host, btrim(p_title), p_is_public, p_event_date, p_ends_at, btrim(p_location),
    p_lat, p_lng, p_background_url, p_invite_code,
    nullif(btrim(p_description), ''), btrim(p_motto), btrim(p_dresscode), p_max_guests, p_price,
    nullif(btrim(p_website_url), ''), nullif(btrim(p_organizer_name), ''),
    p_category,
    case when p_category = 'other' then btrim(p_category_other) end,
    coalesce(p_is_all_day, false),
    case when nullif(btrim(p_website_url), '') is not null then nullif(btrim(p_website_title), '') end
  );

  for v_poll in select value from jsonb_array_elements(v_polls) with ordinality order by ordinality loop
    insert into public.pools (event_id, question, description, type, allow_text_response, allow_multiple, created_at)
    values (p_id, btrim(v_poll->>'question'), null, 'options', false,
            coalesce((v_poll->>'allow_multiple')::boolean, false), clock_timestamp())
    returning id into v_pool_id;

    v_pos := 0;
    for v_option in select value from jsonb_array_elements(v_poll->'options') with ordinality order by ordinality loop
      insert into public.pool_options (pool_id, label, position)
      values (v_pool_id, btrim(v_option #>> '{}'), v_pos);
      v_pos := v_pos + 1;
    end loop;
  end loop;

  for v_question in select value from jsonb_array_elements(v_questions) with ordinality order by ordinality loop
    insert into public.pools (event_id, question, description, type, allow_text_response, allow_multiple, created_at)
    values (p_id, btrim(v_question #>> '{}'), null, 'text_only', true, false, clock_timestamp());
  end loop;

  return p_id;
end;
$function$;
alter function public.create_party owner to postgres;
revoke all on function public.create_party from public, anon;
grant execute on function public.create_party to authenticated, service_role;

drop function if exists public.update_party(p_id uuid, p_title text, p_is_public boolean, p_event_date timestamp with time zone, p_ends_at timestamp with time zone, p_location text, p_lat double precision, p_lng double precision, p_background_url text, p_description text, p_motto text, p_dresscode text, p_max_guests integer, p_polls jsonb, p_questions jsonb, p_price numeric, p_website_url text, p_organizer_name text);
CREATE FUNCTION public.update_party(p_id uuid, p_title text, p_is_public boolean, p_event_date timestamp with time zone, p_ends_at timestamp with time zone, p_location text, p_lat double precision, p_lng double precision, p_background_url text, p_description text, p_motto text, p_dresscode text, p_max_guests integer, p_polls jsonb, p_questions jsonb, p_price numeric DEFAULT NULL::numeric, p_website_url text DEFAULT NULL::text, p_organizer_name text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_category_other text DEFAULT NULL::text, p_is_all_day boolean DEFAULT NULL::boolean, p_website_title text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_host uuid := auth.uid();
  v_polls jsonb := coalesce(p_polls, '[]'::jsonb);
  v_questions jsonb := coalesce(p_questions, '[]'::jsonb);
  v_poll jsonb;
  v_option jsonb;
  v_question jsonb;
  v_pool_id uuid;
  v_option_id uuid;
  v_pos integer;
  v_i integer;
  -- Per incoming poll or question, in order: the pool it keeps, or null for a new one.
  v_poll_ids uuid[] := '{}';
  v_question_ids uuid[] := '{}';
  v_option_ids uuid[];
begin
  if v_host is null then
    raise exception 'update_party: not signed in' using errcode = '42501';
  end if;

  -- Validate everything before the first write. Same limits and messages as create_party.
  if p_title is null or length(btrim(p_title)) not between 1 and 20 then
    raise exception 'Title must be 1 to 20 characters' using errcode = 'check_violation';
  end if;
  if p_motto is not null and length(btrim(p_motto)) not between 1 and 20 then
    raise exception 'Motto must be 1 to 20 characters' using errcode = 'check_violation';
  end if;
  if p_dresscode is not null and length(btrim(p_dresscode)) not between 1 and 20 then
    raise exception 'Dresscode must be 1 to 20 characters' using errcode = 'check_violation';
  end if;
  if p_description is not null and length(p_description) > 500 then
    raise exception 'Description must be at most 500 characters' using errcode = 'check_violation';
  end if;
  if p_max_guests is not null and p_max_guests not between 1 and 500 then
    raise exception 'Max guests must be between 1 and 500' using errcode = 'check_violation';
  end if;
  if p_location is null or btrim(p_location) = '' then
    raise exception 'Location is required' using errcode = 'check_violation';
  end if;
  if p_lat is null or p_lng is null then
    raise exception 'Coordinates are required' using errcode = 'check_violation';
  end if;
  if p_background_url is null then
    raise exception 'Background picture is required' using errcode = 'check_violation';
  end if;
  if p_ends_at is not null and p_ends_at <= p_event_date then
    raise exception 'End must be after start' using errcode = 'check_violation';
  end if;
  if p_ends_at is not null and p_ends_at > p_event_date + interval '30 days' then
    raise exception 'End must be at most 30 days after start' using errcode = 'check_violation';
  end if;
  if p_price is not null and (p_price < 0 or p_price > 9999.99 or p_price <> round(p_price, 2)) then
    raise exception 'Price must be between 0 and 9999.99, at most 2 decimals' using errcode = 'check_violation';
  end if;
  if nullif(btrim(p_organizer_name), '') is not null and length(btrim(p_organizer_name)) > 40 then
    raise exception 'Organizer must be at most 40 characters' using errcode = 'check_violation';
  end if;
  if p_category is not null and p_category not in ('house', 'club', 'open_air', 'festival', 'other') then
    raise exception 'Unknown category' using errcode = 'check_violation';
  end if;
  if p_category = 'other' and (p_category_other is null or length(btrim(p_category_other)) not between 1 and 20) then
    raise exception 'Other category must be 1 to 20 characters' using errcode = 'check_violation';
  end if;
  if nullif(btrim(p_website_title), '') is not null and length(btrim(p_website_title)) > 40 then
    raise exception 'Website title must be at most 40 characters' using errcode = 'check_violation';
  end if;

  if jsonb_typeof(v_polls) <> 'array' then
    raise exception 'Polls must be a list' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(v_polls) > 5 then
    raise exception 'At most 5 polls' using errcode = 'check_violation';
  end if;
  for v_poll in select value from jsonb_array_elements(v_polls) loop
    if jsonb_typeof(v_poll) <> 'object'
       or jsonb_typeof(v_poll->'question') is distinct from 'string'
       or jsonb_typeof(v_poll->'options') is distinct from 'array'
       or jsonb_typeof(v_poll->'allow_multiple') not in ('boolean', 'null') then
      raise exception 'Each poll needs a question, options and allow_multiple' using errcode = 'check_violation';
    end if;
    if length(btrim(v_poll->>'question')) not between 1 and 60 then
      raise exception 'Poll question must be 1 to 60 characters' using errcode = 'check_violation';
    end if;
    if jsonb_array_length(v_poll->'options') not between 2 and 10 then
      raise exception 'A poll needs 2 to 10 options' using errcode = 'check_violation';
    end if;
    for v_option in select value from jsonb_array_elements(v_poll->'options') loop
      if jsonb_typeof(v_option) <> 'string' or length(btrim(v_option #>> '{}')) not between 1 and 30 then
        raise exception 'Poll option must be 1 to 30 characters' using errcode = 'check_violation';
      end if;
    end loop;
  end loop;

  if jsonb_typeof(v_questions) <> 'array' then
    raise exception 'Questions must be a list' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(v_questions) > 5 then
    raise exception 'At most 5 questions' using errcode = 'check_violation';
  end if;
  for v_question in select value from jsonb_array_elements(v_questions) loop
    if jsonb_typeof(v_question) <> 'string' or length(btrim(v_question #>> '{}')) not between 1 and 60 then
      raise exception 'Question must be 1 to 60 characters' using errcode = 'check_violation';
    end if;
  end loop;

  update public.events set
    title = btrim(p_title),
    is_public = p_is_public,
    event_date = p_event_date,
    ends_at = p_ends_at,
    location = btrim(p_location),
    lat = p_lat,
    lng = p_lng,
    background_url = p_background_url,
    description = nullif(btrim(p_description), ''),
    motto = btrim(p_motto),
    dresscode = btrim(p_dresscode),
    max_guests = p_max_guests,
    price = p_price,
    website_url = case
                    when p_website_url is null then website_url
                    else nullif(btrim(p_website_url), '')
                  end,
    organizer_name = case
                       when p_organizer_name is null then organizer_name
                       else nullif(btrim(p_organizer_name), '')
                     end,
    -- Neu (native App). NULL behält den Wert, weil die Web-App die Felder nicht schickt.
    category = coalesce(p_category, category),
    category_other = case
                       when p_category is null then category_other
                       when p_category = 'other' then btrim(p_category_other)
                       else null
                     end,
    is_all_day = coalesce(p_is_all_day, is_all_day),
    -- Ohne Link kein Titel: fällt der Link weg, fällt der Titel mit.
    website_title = case
                      when (case when p_website_url is null then website_url
                                 else nullif(btrim(p_website_url), '') end) is null then null
                      when p_website_title is null then website_title
                      else nullif(btrim(p_website_title), '')
                    end
  where id = p_id and host_id = v_host;
  if not found then
    raise exception 'update_party: no such party of yours' using errcode = '42501';
  end if;

  -- Match: each incoming poll keeps the first not yet kept existing poll with the same
  -- question, so its votes stay. Questions the same way.
  for v_poll in select value from jsonb_array_elements(v_polls) with ordinality order by ordinality loop
    select pl.id into v_pool_id
    from public.pools pl
    where pl.event_id = p_id and pl.type = 'options' and pl.question = btrim(v_poll->>'question')
      and pl.id <> all(array_remove(v_poll_ids, null))
    order by pl.created_at
    limit 1;
    v_poll_ids := array_append(v_poll_ids, v_pool_id);
  end loop;
  for v_question in select value from jsonb_array_elements(v_questions) with ordinality order by ordinality loop
    select pl.id into v_pool_id
    from public.pools pl
    where pl.event_id = p_id and pl.type = 'text_only' and pl.question = btrim(v_question #>> '{}')
      and pl.id <> all(array_remove(v_question_ids, null))
    order by pl.created_at
    limit 1;
    v_question_ids := array_append(v_question_ids, v_pool_id);
  end loop;

  -- Deletes before inserts: the caps on pools and pool_options count on insert only.
  delete from public.pools
  where event_id = p_id
    and id <> all(array_remove(v_poll_ids || v_question_ids, null));

  -- Rewrite in list order. created_at is the sort key of get_party_polls, so kept rows
  -- get a fresh clock_timestamp() too and the order follows the host's list.
  v_i := 0;
  for v_poll in select value from jsonb_array_elements(v_polls) with ordinality order by ordinality loop
    v_i := v_i + 1;
    v_pool_id := v_poll_ids[v_i];

    if v_pool_id is null then
      insert into public.pools (event_id, question, description, type, allow_text_response, allow_multiple, created_at)
      values (p_id, btrim(v_poll->>'question'), null, 'options', false,
              coalesce((v_poll->>'allow_multiple')::boolean, false), clock_timestamp())
      returning id into v_pool_id;
    else
      update public.pools
      set allow_multiple = coalesce((v_poll->>'allow_multiple')::boolean, false), created_at = clock_timestamp()
      where id = v_pool_id;
    end if;

    -- Options of a kept poll: a matching label keeps its row and its votes.
    v_option_ids := '{}';
    for v_option in select value from jsonb_array_elements(v_poll->'options') with ordinality order by ordinality loop
      select po.id into v_option_id
      from public.pool_options po
      where po.pool_id = v_pool_id and po.label = btrim(v_option #>> '{}')
        and po.id <> all(array_remove(v_option_ids, null))
      order by po.position
      limit 1;
      v_option_ids := array_append(v_option_ids, v_option_id);
    end loop;

    delete from public.pool_options
    where pool_id = v_pool_id and id <> all(array_remove(v_option_ids, null));

    v_pos := 0;
    for v_option in select value from jsonb_array_elements(v_poll->'options') with ordinality order by ordinality loop
      if v_option_ids[v_pos + 1] is null then
        insert into public.pool_options (pool_id, label, position)
        values (v_pool_id, btrim(v_option #>> '{}'), v_pos);
      else
        update public.pool_options set position = v_pos where id = v_option_ids[v_pos + 1];
      end if;
      v_pos := v_pos + 1;
    end loop;
  end loop;

  v_i := 0;
  for v_question in select value from jsonb_array_elements(v_questions) with ordinality order by ordinality loop
    v_i := v_i + 1;
    if v_question_ids[v_i] is null then
      insert into public.pools (event_id, question, description, type, allow_text_response, allow_multiple, created_at)
      values (p_id, btrim(v_question #>> '{}'), null, 'text_only', true, false, clock_timestamp());
    else
      update public.pools set created_at = clock_timestamp() where id = v_question_ids[v_i];
    end if;
  end loop;
end;
$function$;
alter function public.update_party owner to postgres;
revoke all on function public.update_party from public, anon;
grant execute on function public.update_party to authenticated, service_role;

-- 4. approve_agent_candidate: Agent-Events bekommen eine Kategorie aus event_type.
CREATE OR REPLACE FUNCTION public.approve_agent_candidate(p_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_candidate private.agent_candidates%rowtype;
  v_host uuid;
  v_event_id uuid := gen_random_uuid();
  v_invite_code text;
begin
  if not private.is_admin() then
    raise exception 'Nur Admins dürfen das.' using errcode = '42501';
  end if;

  select * into v_candidate
  from private.agent_candidates c
  where c.id = p_id and c.kind = 'new' and c.status = 'draft'
  for update;
  if not found then
    raise exception 'Diesen Entwurf gibt es nicht mehr.' using errcode = 'P0002';
  end if;
  if v_candidate.starts_at <= now() then
    raise exception 'Dieses Event hat schon angefangen.' using errcode = '22023';
  end if;

  v_host := private.agent_system_account();
  if v_host is null then
    raise exception 'Systemaccount fehlt in private.agent_config.' using errcode = 'P0002';
  end if;

  -- Wie generateInviteCode in lib/utils.ts: 12 Zeichen aus demselben Alphabet.
  select string_agg(substr('0123456789abcdefghjkmnpqrstvwxyz', get_byte(b.bytes, i) % 32 + 1, 1), '' order by i)
    into v_invite_code
  from (select extensions.gen_random_bytes(12) as bytes) b, generate_series(0, 11) i;

  insert into public.events (
    id, host_id, title, is_public, event_date, ends_at, location, lat, lng,
    background_url, invite_code, description, max_guests, price, website_url,
    category, category_other
  ) values (
    v_event_id, v_host, v_candidate.title, true, v_candidate.starts_at, v_candidate.ends_at,
    v_candidate.location, v_candidate.lat, v_candidate.lng, v_candidate.background_url,
    v_invite_code, v_candidate.description, null, v_candidate.price, v_candidate.website_url,
    -- Native Redesign: der Agent kennt eigene Typen. club, festival und open_air gibt es
    -- auch als Kategorie, concert und other werden zu 'Etwas anderes' mit festem Text.
    case v_candidate.event_type
      when 'club' then 'club'
      when 'festival' then 'festival'
      when 'open_air' then 'open_air'
      else 'other'
    end,
    case v_candidate.event_type
      when 'concert' then 'Konzert'
      when 'other' then 'Event'
    end
  );

  insert into public.agent_event_details (event_id, source_url, starts_on, organizer_name, last_checked_at)
  values (v_event_id, v_candidate.source_url, v_candidate.starts_on, v_candidate.organizer_name, now());

  update private.agent_candidates
  set status = 'approved', event_id = v_event_id, decided_at = now()
  where id = p_id;

  return v_event_id;
end;
$function$;
