-- Rollback zu supabase/migrations/20261114192638_add_agent_proposals.sql.
-- Vorher party-agent auf den Stand ohne Nachpruefung zuruecksetzen: die Funktion schreibt
-- die Spalten rechecked und proposals.

begin;

drop function public.approve_agent_proposal(uuid);
drop function public.get_agent_proposals();
drop index private.agent_candidates_one_open_proposal;
alter table private.agent_runs drop column rechecked, drop column proposals;

commit;
