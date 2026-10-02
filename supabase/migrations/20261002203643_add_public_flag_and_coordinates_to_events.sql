-- add_public_flag_and_coordinates_to_events
--
-- Rollback:
--   ALTER TABLE events
--     DROP CONSTRAINT IF EXISTS events_lat_check,
--     DROP CONSTRAINT IF EXISTS events_lng_check,
--     DROP CONSTRAINT IF EXISTS events_lat_lng_pair_check,
--     DROP CONSTRAINT IF EXISTS events_fuzzy_lat_lng_pair_check,
--     DROP COLUMN IF EXISTS is_public,
--     DROP COLUMN IF EXISTS lat,
--     DROP COLUMN IF EXISTS lng,
--     DROP COLUMN IF EXISTS fuzzy_lat,
--     DROP COLUMN IF EXISTS fuzzy_lng;
--
-- Verified 2026-10-02: columns and constraints exist; the live party has is_public =
-- false; an insert without coordinates still succeeds (rolled-back transaction).

ALTER TABLE events
  ADD COLUMN is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN lat double precision,
  ADD COLUMN lng double precision,
  ADD COLUMN fuzzy_lat double precision,
  ADD COLUMN fuzzy_lng double precision;

ALTER TABLE events
  ADD CONSTRAINT events_lat_check CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
  ADD CONSTRAINT events_lng_check CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180)),
  ADD CONSTRAINT events_lat_lng_pair_check CHECK ((lat IS NULL) = (lng IS NULL)),
  ADD CONSTRAINT events_fuzzy_lat_lng_pair_check CHECK ((fuzzy_lat IS NULL) = (fuzzy_lng IS NULL));
