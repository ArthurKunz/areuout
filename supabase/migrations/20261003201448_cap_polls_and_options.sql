-- cap_polls_and_options
--
-- Rollback:
--   DROP TRIGGER IF EXISTS pools_cap_per_event ON public.pools;
--   DROP TRIGGER IF EXISTS pool_options_cap_per_pool ON public.pool_options;
--   DROP FUNCTION IF EXISTS private.cap_pools_per_event();
--   DROP FUNCTION IF EXISTS private.cap_options_per_pool();
--
-- Verified 2026-10-03 as a real profile, in a rolled-back transaction: a party with 5
-- polls and 5 questions saves (the cap counts per type); a direct 6th 'options' pool
-- and a direct 6th 'text_only' pool each raise 23514; a poll filled to 10 options by
-- direct inserts takes no 11th.

-- At most 5 polls and 5 questions per party, at most 10 options per poll — the same
-- caps create_party checks, enforced here for every insert path, because the anon key
-- ships in the browser and a direct insert into pools/pool_options skips the function.
--
-- Like rsvps_enforce_capacity (SCHEMA.md section 3), each trigger locks the parent row
-- before counting, so two concurrent inserts cannot both see 4 and both make 6.
-- SECURITY DEFINER so the count sees every row, not only the ones RLS shows the caller.
--
-- The old app's edit path deletes a party's polls/options before inserting the new set,
-- so it never hits these caps. The 2-option minimum lives in create_party only: a row
-- trigger sees one option at a time and cannot know whether a second one follows.

CREATE OR REPLACE FUNCTION private.cap_pools_per_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
begin
  perform 1 from public.events where id = new.event_id for update;

  if (select count(*) from public.pools
      where event_id = new.event_id and type = new.type) >= 5 then
    raise exception 'At most 5 % per party', case new.type when 'options' then 'polls' else 'questions' end
      using errcode = 'check_violation';
  end if;

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION private.cap_pools_per_event() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER pools_cap_per_event
  BEFORE INSERT ON public.pools
  FOR EACH ROW
  EXECUTE FUNCTION private.cap_pools_per_event();

CREATE OR REPLACE FUNCTION private.cap_options_per_pool()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
begin
  perform 1 from public.pools where id = new.pool_id for update;

  if (select count(*) from public.pool_options where pool_id = new.pool_id) >= 10 then
    raise exception 'At most 10 options per poll' using errcode = 'check_violation';
  end if;

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION private.cap_options_per_pool() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER pool_options_cap_per_pool
  BEFORE INSERT ON public.pool_options
  FOR EACH ROW
  EXECUTE FUNCTION private.cap_options_per_pool();
