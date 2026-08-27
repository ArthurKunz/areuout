-- Fund A4 aus der Durchsicht vor dem Launch.
--
-- isPartyOver blendet die Adresse aus, sobald eine Party vorbei ist — aber nur in der
-- Oberflaeche. Die RPC lieferte location unveraendert weiter; wer den Link hatte und
-- die API direkt fragte, bekam die Wohnanschrift auch Monate spaeter noch. Abschnitt 6
-- der Datenschutzerklaerung sagt dagegen: "Der Link bleibt gueltig, die Anschrift steht
-- dann aber nicht mehr darin." Diese Migration macht den Satz wahr.
--
-- Drei Dinge muessen dabei genau stimmen, sonst richtet die Aenderung mehr Schaden an
-- als Nutzen:
--
-- 1. Dieselbe Definition von "vorbei" wie in lib/utils.ts. Dort gilt
--    ends_at ?? event_date + 6 Stunden (ASSUMED_PARTY_HOURS). Weicht SQL davon ab,
--    zeigt die Oberflaeche eine Adresse an, die der Server schon verschweigt.
--
-- 2. Der Gastgeber behaelt sie. InviteScreen.tsx:570 rendert den Location-Abschnitt bei
--    `!partyOver || isHost` — seine eigene vergangene Party soll er weiterhin
--    vollstaendig sehen. `is distinct from` statt `<>`, weil auth.uid() fuer einen
--    Besucher ohne Konto NULL ist und `null <> uuid` nicht true ergibt, sondern NULL.
--
-- 3. Leerer String, nicht NULL. Beide Screens rechnen unbedingt mit
--    party.location.lastIndexOf(',') — vor jeder partyOver-Pruefung. Ein NULL wuerde
--    dort werfen und die Einladungsseite jeder vergangenen Party zerlegen. Nachgestellt
--    mit node: '' ergibt {address:'',city:''}, null wirft
--    "TypeError: Cannot read properties of null (reading 'lastIndexOf')".
--
-- Die Bremse aus 20260827104435 bleibt Zeile fuer Zeile unveraendert.
create or replace function public.get_party_by_invite_code(p_invite_code text)
returns table(id uuid, host_id uuid, title text, description text,
              event_date timestamptz, ends_at timestamptz, location text,
              invite_code text, background_url text, max_guests integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  -- 30 Fehlversuche pro IP und Kalenderminute. Gegen 3300 Versuche pro Minute ist das
  -- Faktor 100. Wer eine echte Einladung öffnet, kommt nie in die Nähe; selbst ein
  -- toter Link, den ein ganzer Gruppenchat anklickt, bleibt darunter.
  c_limit constant integer := 30;
  -- Spiegelt ASSUMED_PARTY_HOURS aus lib/utils.ts. Aendert sich der eine Wert, muss
  -- der andere mit.
  c_assumed_hours constant interval := interval '6 hours';
  v_ip text;
  v_misses integer;
begin
  -- Supabase liegt hinter Cloudflare, die echte Adresse steht deshalb in
  -- cf-connecting-ip. x-forwarded-for ist der Rückfall, dessen erster Eintrag.
  -- Fehlt beides, kommt der Aufruf nicht über die REST-API, sondern aus einer
  -- Datenbanksitzung — dort greift die Bremse nicht, dorthin kommt ohnehin nur, wer
  -- Zugangsdaten zur Datenbank hat.
  v_ip := coalesce(
    nullif(current_setting('request.headers', true)::json ->> 'cf-connecting-ip', ''),
    nullif(split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1), '')
  );

  if v_ip is not null then
    select m.misses into v_misses
    from private.invite_lookup_misses m
    where m.client_ip = v_ip
      and m.window_start = date_trunc('minute', now());

    if coalesce(v_misses, 0) >= c_limit then
      -- PostgREST macht aus einem SQLSTATE der Form PTxxx den HTTP-Status xxx.
      raise sqlstate 'PT429' using message = 'Zu viele Versuche. Warte einen Moment.';
    end if;
  end if;

  return query
    select e.id, e.host_id, e.title, e.description, e.event_date, e.ends_at,
           case
             when coalesce(e.ends_at, e.event_date + c_assumed_hours) < now()
                  and auth.uid() is distinct from e.host_id
             then ''
             else e.location
           end,
           e.invite_code, e.background_url, e.max_guests
    from events e
    where e.invite_code = p_invite_code;

  -- FOUND ist nach RETURN QUERY true, sobald mindestens eine Zeile geliefert wurde.
  if not found and v_ip is not null then
    insert into private.invite_lookup_misses as m (client_ip, window_start, misses)
    values (v_ip, date_trunc('minute', now()), 1)
    on conflict (client_ip) do update
      set misses = case
                     when m.window_start = date_trunc('minute', now()) then m.misses + 1
                     else 1
                   end,
          window_start = date_trunc('minute', now());

    -- Aufräumen nebenbei statt per Cron: in etwa einem von hundert Fehlversuchen
    -- fliegen die Zeilen raus, deren Fenster über eine Stunde zurückliegt.
    if random() < 0.01 then
      delete from private.invite_lookup_misses
      where window_start < now() - interval '1 hour';
    end if;
  end if;
end;
$function$;
