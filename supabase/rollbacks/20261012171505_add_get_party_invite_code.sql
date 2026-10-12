-- Rollback zu supabase/migrations/20261012171505_add_get_party_invite_code.sql.
-- Erst ausfuehren, wenn die App den Code nicht mehr ueber diese Funktion liest und
-- SELECT (invite_code) fuer authenticated wieder vergeben ist (Rollback von
-- …_hide_the_invite_code_of_events.sql), sonst sieht der Host keinen Link mehr.

drop function public.get_party_invite_code(uuid);
