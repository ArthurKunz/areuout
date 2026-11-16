-- Rollback zu supabase/migrations/20261115205332_schedule_party_agent.sql.
-- Danach laeuft der Agent nur noch von Hand (curl) und schickt keine Push mehr: vorher
-- party-agent auf den Stand mit Push pro Aufruf zuruecksetzen (Commit 017ea52).
-- pg_cron bleibt eingeschaltet; die Jobs sind weg.

begin;

select cron.unschedule(jobname) from cron.job
where jobname in ('party-agent-club', 'party-agent-concert', 'party-agent-festival',
                  'party-agent-open-air', 'party-agent-finish', 'agent-expire-candidates');

drop view private.agent_cost_by_month;
drop function private.expire_agent_candidates();
drop function private.finish_agent_run();
drop function private.call_party_agent(text);

commit;
