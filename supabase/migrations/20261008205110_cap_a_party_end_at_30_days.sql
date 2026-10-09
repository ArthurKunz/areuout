-- Das Ende einer Party darf hoechstens 30 Tage nach dem Start liegen.
--
-- Seit Schritt 11c waehlt der Host das Enddatum selbst. Vorher war ends_at eine reine
-- Uhrzeit und lag damit immer innerhalb eines Tages nach dem Start -- ein absurd weit
-- entferntes Ende war schlicht nicht eingebbar. Jetzt schon, und das trifft die
-- 24-Stunden-Regel: private.party_visible_until zaehlt ab dem ENDE, eine Party mit einem
-- Ende in drei Monaten stuende also drei Monate lang auf der Karte und in jeder Liste.
--
-- Die Grenze steht in den Funktionen und NICHT als CHECK auf der Tabelle. Eine CHECK
-- ueber zwei Spalten wuerde auch fuer die alte App gelten, die events direkt ueber
-- PostgREST schreibt und ends_at weiterhin nach der alten Regel bildet; ein Speichern
-- koennte dort an einer Party scheitern, die bei ihrer Anlage erlaubt war. Bestehende
-- Zeilen werden so oder so nicht angefasst.
--
-- Gespiegelt von MAX_PARTY_DAYS in features/create-party/draft.ts -- wer eines aendert,
-- aendert das andere.
--
-- Gleiche Signatur wie bisher, also create or replace: kein DROP, keine Grants in
-- Gefahr. Geaendert ist in beiden Funktionen genau ein Block.

CREATE OR REPLACE FUNCTION public.create_party(p_id uuid, p_title text, p_is_public boolean, p_event_date timestamp with time zone, p_ends_at timestamp with time zone, p_location text, p_lat double precision, p_lng double precision, p_background_url text, p_invite_code text, p_description text, p_motto text, p_dresscode text, p_max_guests integer, p_polls jsonb, p_questions jsonb, p_price numeric DEFAULT NULL)
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
  if p_price is not null and (p_price <= 0 or p_price > 9999.99) then
    raise exception 'Price must be between 0.01 and 9999.99' using errcode = 'check_violation';
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
    background_url, invite_code, description, motto, dresscode, max_guests, price
  ) values (
    p_id, v_host, btrim(p_title), p_is_public, p_event_date, p_ends_at, btrim(p_location),
    p_lat, p_lng, p_background_url, p_invite_code,
    nullif(btrim(p_description), ''), btrim(p_motto), btrim(p_dresscode), p_max_guests, p_price
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_party(p_id uuid, p_title text, p_is_public boolean, p_event_date timestamp with time zone, p_ends_at timestamp with time zone, p_location text, p_lat double precision, p_lng double precision, p_background_url text, p_description text, p_motto text, p_dresscode text, p_max_guests integer, p_polls jsonb, p_questions jsonb, p_price numeric DEFAULT NULL)
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
  if p_price is not null and (p_price <= 0 or p_price > 9999.99) then
    raise exception 'Price must be between 0.01 and 9999.99' using errcode = 'check_violation';
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
    price = p_price
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
$function$
;

