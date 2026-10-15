-- Rollback zu supabase/migrations/20261014200517_create_blocks.sql.
-- Erst die Rollbacks 20261014201200, 20261014200600 und 20261014200539 ausfuehren: sie
-- haengen an den beiden Hilfsfunktionen und an der Tabelle. Danach die Typen neu erzeugen.

begin;

drop function public.get_my_blocked_users();
drop function private.is_blocked_between(uuid, uuid);
drop function private.has_blocked(uuid, uuid);
drop table public.blocks;

commit;
