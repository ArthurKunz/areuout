-- add_update_party_function
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.update_party(uuid, text, boolean, timestamptz, timestamptz, text, double precision, double precision, text, text, text, text, integer, jsonb, jsonb);
--
-- Why one function: the redesigned Edit Party form saves a party, its polls (with their
-- options) and its questions in a single call, the same way create_party creates them.
-- Any failure rolls the whole edit back, so there is never a half-saved party. The old
-- EditPartyScreen keeps its many separate requests and is not touched by this.
--
-- SECURITY INVOKER on purpose, as create_party: every write still passes the caller's
-- RLS (events_update_host, pools_*_host, pool_options_*_host), and the update only hits
-- a row whose host_id is auth.uid(); otherwise 42501.
--
-- Same limits and messages as create_party, all checked before the first write.
-- invite_code is not touched (Link-reset does that). is_public is a plain column: rsvps
-- and invite_opens stay as they are, so switching to private removes no guest.
-- fuzzy_lat/fuzzy_lng are never set here: events_set_fuzzy_position keeps the blurred
-- point when lat/lng are unchanged and rolls a new one when they move.
--
-- Polls and questions are matched by text: an incoming poll keeps the first not yet
-- kept existing poll with the same question, and inside it an option keeps the row with
-- the same label, so their votes and answers stay. Changed text counts as new. Unmatched
-- rows are deleted before anything is inserted, because pools_cap_per_event and
-- pool_options_cap_per_pool count on insert only. A deleted option's votes keep their
-- pool_responses row with option_id null (ON DELETE SET NULL), exactly as with the old
-- edit path: the host cannot delete other users' responses under RLS.
--
-- created_at is the sort key of get_party_polls, so kept rows get a fresh
-- clock_timestamp() as well and the order follows the host's list.

CREATE OR REPLACE FUNCTION public.update_party(
  p_id uuid,
  p_title text,
  p_is_public boolean,
  p_event_date timestamptz,
  p_ends_at timestamptz,
  p_location text,
  p_lat double precision,
  p_lng double precision,
  p_background_url text,
  p_description text,
  p_motto text,
  p_dresscode text,
  p_max_guests integer,
  p_polls jsonb,
  p_questions jsonb
)
RETURNS void
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
    max_guests = p_max_guests
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

REVOKE ALL ON FUNCTION public.update_party(uuid, text, boolean, timestamptz, timestamptz, text, double precision, double precision, text, text, text, text, integer, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_party(uuid, text, boolean, timestamptz, timestamptz, text, double precision, double precision, text, text, text, text, integer, jsonb, jsonb) TO authenticated;
