-- Rollback zu supabase/migrations/20261009180200_hide_the_address_columns_of_events.sql:
-- SELECT auf die ganze Tabelle wieder fuer anon und authenticated, wie bis zum 09.10.2026.
-- Die Spaltenrechte werden zuerst entfernt, sonst blieben sie neben dem Tabellenrecht
-- stehen.

revoke select (
  id, host_id, title, description, invite_code, event_date, max_guests, created_at,
  background_url, ends_at, motto, dresscode, is_public, fuzzy_lat, fuzzy_lng, price
) on public.events from authenticated;

grant select on public.events to anon, authenticated;
