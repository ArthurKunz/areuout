-- Rollback zu supabase/migrations/20261009180300_drop_a_removed_guests_votes_and_answers.sql:
-- ein entfernter Gast behaelt seine Stimmen und Antworten wieder. Schon geloeschte
-- Stimmen kommen dadurch nicht zurueck.

drop trigger rsvps_drop_pool_responses on public.rsvps;
drop function private.drop_pool_responses_on_rsvp_delete();
