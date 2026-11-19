-- Rollback zu supabase/migrations/20261119152029_hide_the_website_column_of_events.sql.
-- Gibt die Spalte events.website_url wieder fuer Host und Gaeste direkt lesbar frei (Stand
-- nach 20261111212120).

grant select (website_url) on public.events to authenticated;
