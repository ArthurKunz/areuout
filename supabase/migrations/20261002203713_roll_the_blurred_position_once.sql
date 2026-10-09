-- roll_the_blurred_position_once
--
-- Rollback:
--   DROP TRIGGER IF EXISTS events_set_fuzzy_position ON events;
--   DROP FUNCTION IF EXISTS private.set_fuzzy_position();
--
-- Verified 2026-10-02, all in a rolled-back transaction: 1,000 inserts at a fixed
-- point, max distance 199.68 m, average 131.28 m, min 2.90 m; a title-only update
-- leaves the fuzzy point byte-identical; a client write to fuzzy_lat/fuzzy_lng
-- directly is silently overwritten back to the trigger's own value; clearing the
-- address without new coordinates clears lat, lng, fuzzy_lat and fuzzy_lng to NULL.

CREATE OR REPLACE FUNCTION private.set_fuzzy_position()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
declare
  r double precision;
  theta double precision;
begin
  -- Location changed without new coordinates (the old edit screen's path): clear
  -- everything so a stale exact or blurred point never survives an address edit.
  if new.lat is null then
    new.fuzzy_lat := null;
    new.fuzzy_lng := null;
    return new;
  end if;

  if tg_op = 'UPDATE' and old.lat is not distinct from new.lat and old.lng is not distinct from new.lng then
    -- Coordinates unchanged: copy the stored point back, so a client write to the
    -- fuzzy columns directly is silently overwritten, never a client-chosen value.
    new.fuzzy_lat := old.fuzzy_lat;
    new.fuzzy_lng := old.fuzzy_lng;
    return new;
  end if;

  -- New or changed coordinates: roll a new point once, uniformly within 200 m.
  r := 200.0 * sqrt(random());
  theta := 2 * pi() * random();
  new.fuzzy_lat := new.lat + (r * cos(theta)) / 111320.0;
  new.fuzzy_lng := new.lng + (r * sin(theta)) / (111320.0 * cos(radians(new.lat)));

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION private.set_fuzzy_position() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER events_set_fuzzy_position
  BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION private.set_fuzzy_position();
