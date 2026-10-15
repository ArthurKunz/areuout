-- Melden: Tabelle, Tageslimit und submit_report (Schritt 13b, App Store 1.2 und
-- Google Play UGC).
--
-- public.reports nimmt Meldungen zu einer Party, einer Antwort oder einer Person auf.
-- Gruende aus einer festen Liste, kein Freitext. answer_text ist der Wortlaut der
-- gemeldeten Antwort zum Zeitpunkt der Meldung (hoechstens 25 Zeichen, wie
-- pool_responses_text_max_25). Arthur liest die Tabelle ueber das Dashboard oder MCP;
-- der Versand per E-Mail kommt in einer spaeteren Sitzung.
--
-- RLS an und KEINE Policy, dazu keine Rechte fuer anon und authenticated: aus der App ist
-- die Tabelle weder lesbar noch schreibbar. Zeilen kommen nur ueber submit_report.
--
-- Wiederholung: UNIQUE NULLS NOT DISTINCT pro Melder und Ziel, eine zweite gleiche
-- Meldung ist ein stilles Nichts. Tageslimit: 20 Meldungen pro Melder in 24 Stunden, im
-- BEFORE-INSERT-Trigger mit pg_advisory_xact_lock, weil RLS nicht serialisiert
-- (SCHEMA.md Abschnitt 3).
--
-- Alle FKs ON DELETE CASCADE (SCHEMA.md Abschnitt 7): ein geloeschtes Konto oder eine
-- geloeschte Party nimmt ihre Meldungen mit.

begin;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  kind text not null,
  reason text not null,
  answer_text text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint reports_kind_check check (kind in ('party', 'answer', 'user')),
  constraint reports_reason_check check (reason in ('spam', 'harassment', 'inappropriate', 'other')),
  constraint reports_status_check check (status in ('open', 'handled')),
  constraint reports_not_self check (reporter_id <> reported_user_id),
  constraint reports_event_only_for_content check ((kind = 'user') = (event_id is null)),
  constraint reports_answer_text_only_for_answers check ((kind = 'answer') = (answer_text is not null)),
  constraint reports_answer_text_max_25 check (char_length(answer_text) <= 25),
  constraint reports_once_per_target unique nulls not distinct (reporter_id, kind, reported_user_id, event_id, answer_text)
);

create index reports_reporter_created_idx on public.reports (reporter_id, created_at);
create index reports_reported_user_id_idx on public.reports (reported_user_id);
create index reports_event_id_idx on public.reports (event_id);

alter table public.reports enable row level security;

revoke all on public.reports from anon, authenticated;

create function private.cap_reports_per_day()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  perform pg_advisory_xact_lock(hashtext('reports:' || new.reporter_id::text));

  if (
    select count(*) from public.reports r
    where r.reporter_id = new.reporter_id
      and r.created_at > now() - interval '24 hours'
  ) >= 20 then
    raise exception 'Du hast heute schon 20 Meldungen geschickt. Versuch es morgen noch mal.' using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

revoke all on function private.cap_reports_per_day() from public;

create trigger reports_cap_per_day
  before insert on public.reports
  for each row execute function private.cap_reports_per_day();

create function public.submit_report(
  p_kind text,
  p_reported_user_id uuid,
  p_event_id uuid,
  p_answer_text text,
  p_reason text
)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_found boolean;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if p_reported_user_id = v_uid then
    raise exception 'Du kannst dich nicht selbst melden.' using errcode = '22023';
  end if;

  -- Das Ziel muss genau so existieren, wie es gemeldet wird. Eine Antwort nur, wenn der
  -- Melder sie sehen darf (dieselbe Regel wie get_party_poll_data), damit die Meldung
  -- keine Antworten auf privaten Partys abtasten kann.
  v_found := case p_kind
    when 'party' then exists (
      select 1 from public.events e
      where e.id = p_event_id and e.host_id = p_reported_user_id)
    when 'answer' then exists (
      select 1
      from public.pool_responses pr
      join public.pools pl on pl.id = pr.pool_id
      join public.events e on e.id = pl.event_id
      where pl.event_id = p_event_id
        and pr.user_id = p_reported_user_id
        and pr.text_response = p_answer_text
        and (e.is_public or public.is_party_member(p_event_id)))
    when 'user' then p_event_id is null and exists (
      select 1 from public.profiles p where p.id = p_reported_user_id)
    else true -- an unknown kind fails on reports_kind_check below
  end;

  if not v_found then
    raise exception 'Das können wir nicht mehr finden.' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.reports r
    where r.reporter_id = v_uid
      and r.kind = p_kind
      and r.reported_user_id = p_reported_user_id
      and r.event_id is not distinct from p_event_id
      and r.answer_text is not distinct from p_answer_text
  ) then
    return;
  end if;

  insert into public.reports (reporter_id, reported_user_id, event_id, kind, reason, answer_text)
  values (v_uid, p_reported_user_id, p_event_id, p_kind, p_reason, p_answer_text)
  on conflict on constraint reports_once_per_target do nothing;
end;
$function$;

revoke all on function public.submit_report(text, uuid, uuid, text, text) from public, anon;
grant execute on function public.submit_report(text, uuid, uuid, text, text) to authenticated, service_role;

commit;
