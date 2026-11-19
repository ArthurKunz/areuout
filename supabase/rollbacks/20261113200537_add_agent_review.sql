-- Rollback zu supabase/migrations/20261113200537_add_agent_review.sql.
-- Erst die Edge Function party-agent ohne den Aufruf von private.queue_admin_push
-- deployen (sonst nur eine Warnung pro Lauf, der Lauf selbst geht weiter) und die App ohne
-- /admin ausliefern. Freigegebene Events bleiben in events stehen.

begin;

drop function private.queue_admin_push(text);
drop function public.discard_agent_candidate(uuid);
drop function public.approve_agent_candidate(uuid);
drop function public.get_agent_drafts();
drop function public.am_i_admin();

commit;
