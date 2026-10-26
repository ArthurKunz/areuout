-- Rollback zu supabase/migrations/20261025130000_create_push_tokens.sql.
-- Spaetere Push-Migrationen (queue_push, Trigger, pg_cron) haengen an der Tabelle: erst
-- deren Rollbacks ausfuehren. Danach die Typen neu erzeugen.

begin;

drop function public.register_push_token(text);
drop table public.push_tokens;

commit;
