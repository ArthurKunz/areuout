-- Rollback zu supabase/migrations/20261014200600_add_block_and_unblock.sql.
-- Danach die Typen neu erzeugen und die Version aus supabase_migrations.schema_migrations
-- entfernen.

begin;

drop function public.unblock_user(uuid);
drop function public.block_user(uuid);

commit;
