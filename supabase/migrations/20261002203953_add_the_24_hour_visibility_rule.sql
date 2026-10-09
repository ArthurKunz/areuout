-- add_the_24_hour_visibility_rule
--
-- A separate, later cutoff from ASSUMED_PARTY_HOURS/c_assumed_hours (6 hours, which
-- only decides when get_party_by_invite_code stops handing out the address): this one
-- decides when a party leaves every map and list. See the hard rule in CLAUDE.md
-- naming both pairs.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS private.party_visible_until(timestamptz, timestamptz);
--   (and revert the PARTY_VISIBLE_HOURS line in lib/utils.ts)
--
-- Verified 2026-10-02: with an ends_at of 2026-10-11 02:00+00, visible_until =
-- 2026-10-12 02:00+00; without an ends_at (event_date 2026-10-10 20:00+00),
-- visible_until = 2026-10-11 20:00+00. ASSUMED_PARTY_HOURS/c_assumed_hours confirmed
-- untouched (interval '6 hours' still present in get_party_by_invite_code).

CREATE OR REPLACE FUNCTION private.party_visible_until(p_event_date timestamptz, p_ends_at timestamptz)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  select coalesce(p_ends_at, p_event_date) + interval '24 hours';
$function$;

REVOKE ALL ON FUNCTION private.party_visible_until(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
