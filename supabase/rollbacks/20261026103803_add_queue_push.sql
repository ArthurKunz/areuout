-- Rollback zu supabase/migrations/20261026103803_add_queue_push.sql.
-- Die Push-Trigger und RPCs der spaeteren Migrationen rufen queue_push auf: erst deren
-- Rollbacks ausfuehren. Das Vault-Geheimnis push_secret bleibt stehen; wer es auch
-- loswerden will, loescht es von Hand im Dashboard (Vault).

begin;

drop function private.queue_push(uuid, uuid, uuid, text);

commit;
