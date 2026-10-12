-- Rollback zu supabase/migrations/20261012173022_hide_the_invite_code_of_events.sql:
-- jeder Gast mit RSVP kann invite_code wieder direkt lesen.

grant select (invite_code) on public.events to authenticated;
