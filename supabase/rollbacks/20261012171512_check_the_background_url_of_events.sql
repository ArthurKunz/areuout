-- Rollback zu supabase/migrations/20261012171512_check_the_background_url_of_events.sql:
-- events.background_url nimmt wieder jede URL an. Im SQL-Editor ausfuehren (DROP).

alter table public.events drop constraint events_background_url_check;
