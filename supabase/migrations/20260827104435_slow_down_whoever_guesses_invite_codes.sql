-- Bremse für die eine Funktion, die jeder ohne Konto aufrufen darf.
--
-- Gemessen am 21.08. gegen die Live-API: 150 von 150 Anfragen beantwortet, 55 pro
-- Sekunde von einer Maschine, kein Limit. Die Verlängerung des Codes auf 12 Base32-
-- Symbole (60 Bit) hat das Raten praktisch erledigt — aus 90 Minuten wurden 180 Jahre —,
-- aber sie hilft nicht gegen die Partys mit den alten kurzen Codes und nicht gegen
-- jemanden, der schlicht das Free-Tier-Kontingent leerläuft.
--
-- Gezählt werden NUR Fehlversuche. Das ist der Kern: Wer einen echten Einladungslink
-- öffnet, trifft einen Code und wird nie gezählt. Wer Codes durchprobiert, produziert
-- fast ausschliesslich Fehlversuche. Eine Bremse auf allen Aufrufen hätte dagegen die
-- serverseitige Vorschau getroffen, die für ALLE Besucher von wenigen Vercel-IPs kommt.
--
-- Die Prüfung steht VOR dem Hochzählen, und das mit Absicht: raise exception rollt die
-- Transaktion zurück, ein Hochzählen im selben Aufruf wäre also wieder weg. So genügt
-- es, dass der Zähler das Limit einmal erreicht — die Tür bleibt für den Rest der
-- Minute zu.
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
           e.location, e.invite_code, e.background_url, e.max_guests
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
