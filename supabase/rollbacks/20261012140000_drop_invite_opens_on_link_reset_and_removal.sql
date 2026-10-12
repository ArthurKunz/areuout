-- Rollback zu supabase/migrations/20261012140000_drop_invite_opens_on_link_reset_and_removal.sql:
-- Link zuruecksetzen und Gast entfernen lassen invite_opens wieder stehen. Schon
-- geloeschte Zeilen kommen dadurch nicht zurueck.

drop trigger rsvps_drop_invite_open on public.rsvps;
drop function private.drop_invite_open_on_rsvp_delete();
drop trigger events_drop_invite_opens on public.events;
drop function private.drop_invite_opens_on_new_code();
