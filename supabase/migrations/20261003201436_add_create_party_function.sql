-- add_create_party_function
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.create_party(uuid, text, boolean, timestamptz, timestamptz, text, double precision, double precision, text, text, text, text, text, integer, jsonb, jsonb);
--
-- Verified 2026-10-03 as a real profile (role authenticated, jwt sub set), all in a
-- rolled-back transaction: a full call with 2 polls (3 options, allow_multiple) and 1
-- question writes 1 events row with host_id = jwt sub, trimmed texts, fuzzy_lat/lng
-- rolled by the trigger, both polls with options at positions 0..n, and the question
-- as a text_only pool; a 21-character title, a 1-option poll and 6 polls each raise
-- 23514 and leave no events row; anon gets "permission denied for function".

-- Why one function: the create flow saves a party, its polls (with their options) and
-- its questions in a single call, so the save is atomic. Any failure — a limit below,
-- a CHECK, an RLS rejection, a lost connection — rolls the whole thing back, and there
-- is never a half-created party without the polls the host just wrote.
--
-- SECURITY INVOKER on purpose: every insert still passes the caller's RLS (events
-- host_id = auth.uid(), pools/pool_options only for the host of the parent event), so
-- this function grants nothing a signed-in host could not already do in three calls.
--
-- The limits mirror the create flow's LIMITS on the client: title, motto and dresscode
-- 1..20 characters after trimming, description up to 500, max_guests 1..500, up to 5
-- polls with 2..10 options each (question 1..60, option 1..30), up to 5 questions
-- (1..60). The client checks them for the interface; this is what actually holds.
-- Violations raise check_violation (23514) with a readable message.
--
-- fuzzy_lat/fuzzy_lng are not set here: the events_set_fuzzy_position trigger rolls
-- them from lat/lng. pools.created_at is set from clock_timestamp() so the rows keep
-- array order — get_party_polls sorts by created_at, and now() would give every row in
-- this transaction the same value.

CREATE OR REPLACE FUNCTION public.create_party(
  p_id uuid,
  p_title text,
  p_is_public boolean,
  p_event_date timestamptz,
  p_ends_at timestamptz,
  p_location text,
  p_lat double precision,
  p_lng double precision,
  p_background_url text,
  p_invite_code text,
  p_description text,
  p_motto text,
  p_dresscode text,
  p_max_guests integer,
  p_polls jsonb,
  p_questions jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
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
    background_url, invite_code, description, motto, dresscode, max_guests
  ) values (
    p_id, v_host, btrim(p_title), p_is_public, p_event_date, p_ends_at, btrim(p_location),
    p_lat, p_lng, p_background_url, p_invite_code,
    nullif(btrim(p_description), ''), btrim(p_motto), btrim(p_dresscode), p_max_guests
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

REVOKE ALL ON FUNCTION public.create_party(uuid, text, boolean, timestamptz, timestamptz, text, double precision, double precision, text, text, text, text, text, integer, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_party(uuid, text, boolean, timestamptz, timestamptz, text, double precision, double precision, text, text, text, text, text, integer, jsonb, jsonb) TO authenticated;
