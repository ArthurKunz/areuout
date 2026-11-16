-- Agent-Schritt 7: der Party-Agent laeuft von selbst, jeden Montag und Donnerstag
-- (Vault: Party Agent, Abschnitte 7 und 8; Party Agent Build Order, Schritt 7).
--
-- - pg_cron wird eingeschaltet (D7 aus der Datenbank-Review).
-- - private.call_party_agent(category): ruft party-agent fuer eine Kategorie ueber pg_net auf.
--   Das Secret kommt zur Laufzeit aus dem Vault (Name agent_secret, von Arthur selbst
--   angelegt), nie aus dieser Datei, einem Job-Text oder einem Log. Fehlt es, schreibt die
--   Funktion eine Fehler-Zeile in den Lauf-Log.
-- - private.finish_agent_run(): 20 Minuten nach dem letzten Aufruf. Schliesst Aufrufe ohne
--   Abschluss als Fehler ab, traegt fehlende Kategorien als Fehler-Zeile ein und schickt
--   EINE Push pro vollem Lauf (statt einer pro Kategorie wie seit Schritt 4). Kein
--   automatischer Neuversuch; der naechste geplante Lauf startet normal.
-- - private.expire_agent_candidates(): stuendlich. Entwuerfe und offene Vorschlaege, deren
--   Event begonnen hat, werden 'expired' (dieselben Regeln wie in get_agent_drafts und
--   get_agent_proposals, die das weiterhin beim Laden des Admin-Screens tun).
-- - private.agent_cost_by_month: Kosten, Tokens und Suchen pro Monat aus dem Lauf-Log.
--
-- Zeiten: pg_cron rechnet in UTC. 13:00 UTC ist 14:00 in Leipzig im Winter, 15:00 im Sommer.

create extension if not exists pg_cron with schema pg_catalog;

-- Ein Aufruf von party-agent fuer eine Kategorie.
create function private.call_party_agent(p_category text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select s.decrypted_secret into v_secret
  from vault.decrypted_secrets s
  where s.name = 'agent_secret';

  if v_secret is null then
    insert into private.agent_runs (category, model, finished_at, error)
    values (p_category, '-', now(), 'Nicht gestartet: Vault-Secret agent_secret fehlt');
    return;
  end if;

  -- pg_net schickt nach dem COMMIT. Die Antwort ist egal: party-agent schreibt seine
  -- Zeile selbst, und finish_agent_run bemerkt jeden Aufruf ohne Zeile oder Abschluss.
  perform net.http_post(
    url := 'https://desolyjfpbxlydbdqixp.supabase.co/functions/v1/party-agent',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-agent-secret', v_secret),
    body := jsonb_build_object('category', p_category),
    timeout_milliseconds := 400000);
end;
$$;

-- Abschluss eines vollen Laufs: Fehler eintragen und eine Push an die Admins.
create function private.finish_agent_run()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_since constant timestamptz := now() - interval '55 minutes';
  v_drafts int;
  v_proposals int;
  v_waiting int;
  v_failed text;
  v_reason text;
  v_parts text[] := '{}';
begin
  -- Aufrufe ohne Abschluss: Zeitlimit oder Absturz der Funktion.
  update private.agent_runs
  set finished_at = now(), error = 'Abgebrochen: kein Abschluss (Zeitlimit oder Absturz)'
  where started_at >= v_since and finished_at is null;

  -- Kategorien ohne Zeile: party-agent nicht erreicht oder Secret falsch (403).
  insert into private.agent_runs (category, model, finished_at, error)
  select c, '-', now(), 'Nicht gestartet: keine Antwort von party-agent'
  from unnest(array['club', 'concert', 'festival', 'open_air']) c
  where not exists (
    select 1 from private.agent_runs r where r.category = c and r.started_at >= v_since);

  select coalesce(sum(drafts), 0), coalesce(sum(proposals), 0),
         string_agg(category, ', ' order by category) filter (where error is not null),
         min(error) filter (where error is not null)
  into v_drafts, v_proposals, v_failed, v_reason
  from private.agent_runs
  where started_at >= v_since;

  -- Derselbe Text wie bisher pro Aufruf, jetzt einmal fuer den ganzen Lauf.
  v_waiting := v_drafts + v_proposals;
  if v_waiting > 0 then
    v_parts := v_parts || (
      concat_ws(' und ',
        case when v_drafts = 1 then '1 neues Event' when v_drafts > 1 then v_drafts || ' neue Events' end,
        case when v_proposals = 1 then '1 Änderung' when v_proposals > 1 then v_proposals || ' Änderungen' end)
      || case when v_waiting = 1 then ' wartet' else ' warten' end || ' auf dich');
  end if;
  if v_failed is not null then
    v_parts := v_parts || ('Agent-Lauf fehlgeschlagen: ' || v_failed || ' – ' || v_reason);
  end if;

  if cardinality(v_parts) > 0 then
    -- queue_admin_push faengt seine Fehler selbst und kuerzt auf 200 Zeichen.
    perform private.queue_admin_push(array_to_string(v_parts, ' · '));
  end if;
end;
$$;

-- Entwuerfe und offene Vorschlaege, deren Event begonnen hat, laufen ab.
create function private.expire_agent_candidates()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.agent_candidates c
  set status = 'expired', decided_at = now()
  where c.status = 'draft' and c.kind = 'new' and c.starts_at <= now();

  update private.agent_candidates c
  set status = 'expired', decided_at = now()
  from public.events e
  where e.id = c.event_id
    and c.status = 'draft' and c.kind in ('change', 'cancel')
    and e.event_date <= now();
end;
$$;

revoke all on function private.call_party_agent(text) from public, anon, authenticated;
revoke all on function private.finish_agent_run() from public, anon, authenticated;
revoke all on function private.expire_agent_candidates() from public, anon, authenticated;

-- Kosten pro Monat (Monat in Leipziger Zeit). Lesen nur im SQL-Editor:
-- select * from private.agent_cost_by_month;
create view private.agent_cost_by_month
with (security_invoker = true)
as
select
  date_trunc('month', started_at at time zone 'Europe/Berlin')::date as month,
  count(*) as calls,
  count(*) filter (where error is not null) as failed_calls,
  sum(drafts) as drafts,
  sum(proposals) as proposals,
  sum(input_tokens) as input_tokens,
  sum(output_tokens) as output_tokens,
  sum(web_searches) as web_searches,
  coalesce(sum(cost_usd), 0) as cost_usd
from private.agent_runs
group by 1
order by 1 desc;

revoke all on private.agent_cost_by_month from public, anon, authenticated;

-- Montag und Donnerstag: vier Aufrufe im Abstand von 10 Minuten (ein Aufruf dauerte bisher
-- 37 bis 125 Sekunden), 20 Minuten spaeter der Abschluss mit der Push.
select cron.schedule('party-agent-club',     '0 13 * * 1,4',  $c$select private.call_party_agent('club')$c$);
select cron.schedule('party-agent-concert',  '10 13 * * 1,4', $c$select private.call_party_agent('concert')$c$);
select cron.schedule('party-agent-festival', '20 13 * * 1,4', $c$select private.call_party_agent('festival')$c$);
select cron.schedule('party-agent-open-air', '30 13 * * 1,4', $c$select private.call_party_agent('open_air')$c$);
select cron.schedule('party-agent-finish',   '50 13 * * 1,4', $c$select private.finish_agent_run()$c$);
select cron.schedule('agent-expire-candidates', '5 * * * *',  $c$select private.expire_agent_candidates()$c$);
