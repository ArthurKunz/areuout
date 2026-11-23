-- Rollback zu supabase/migrations/20261123123041_push_party_changes_and_reminder.sql.
-- Entfernt Aenderungs-Push, Absage-Push und die Erinnerung 48 Stunden vorher. Danach schickt
-- approve_agent_proposal bei 'change' wieder selbst eine Push (Stand vor 2026-11-23).

select cron.unschedule('party-reminders');

drop trigger if exists events_push_changes on public.events;
drop trigger if exists events_push_cancelled on public.events;
drop function if exists private.push_party_changes();
drop function if exists private.push_party_cancelled();
drop function if exists private.send_party_reminders();
drop table if exists private.party_reminders;

do $rollback$
declare
  v_def text;
  c_old constant text := '  -- Aenderungen meldet seit 2026-11-23 der Trigger events_push_changes.
  if v_candidate.kind = ''change'' then
    return;
  end if;

';
begin
  v_def := pg_get_functiondef('public.approve_agent_proposal(uuid)'::regprocedure);
  if position(c_old in v_def) = 0 then
    raise exception 'approve_agent_proposal: Block nicht gefunden';
  end if;
  execute replace(v_def, c_old, '');
end
$rollback$;
