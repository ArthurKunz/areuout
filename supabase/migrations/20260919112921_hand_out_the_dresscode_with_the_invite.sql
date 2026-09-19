-- Die Einladungsseite liest die Party NICHT aus der Tabelle, sondern ueber diese RPC —
-- sie ist der einzige Weg, der ohne Konto funktioniert. Ihre Spaltenliste ist fest,
-- dresscode muss also hinein, sonst sieht ein ausgeloggter Besucher den Dresscode nie.
--
-- Drei Dinge an dieser Migration sind heikel, dieselben wie beim Motto:
--
-- 1. `create or replace` reicht nicht. Postgres laesst den Rueckgabetyp einer Funktion
--    nicht aendern, die Funktion muss also gedroppt und neu angelegt werden.
--
-- 2. Der DROP nimmt die Grants mit. Vorher standen auf der Funktion PUBLIC, anon,
--    authenticated und service_role. PUBLIC kommt beim CREATE von selbst zurueck, die
--    drei Rollen nicht — ohne das GRANT unten ist die Einladungsseite ohne Konto tot.
--
-- 3. Alles andere ist Zeile fuer Zeile aus
--    20260918214737_hand_out_the_motto_with_the_invite.sql
--    uebernommen: die Bremse gegen das Raten von Codes und die Adressmaskierung. Wer
--    hier etwas veraendert, macht aus einer Feature-Migration eine Sicherheitsaenderung.
--    c_assumed_hours bleibt bei sechs Stunden und damit gleich ASSUMED_PARTY_HOURS in
--    lib/utils.ts; CLAUDE.md nennt die beiden ausdruecklich als denselben Wert, zweimal
--    geschrieben. Geaendert sind genau zwei Stellen: `dresscode text` in der
--    returns-Liste und `e.dresscode` im select.
drop function if exists public.get_party_by_invite_code(text);

create function public.get_party_by_invite_code(p_invite_code text)
returns table(id uuid, host_id uuid, title text, description text, motto text,
              dresscode text, event_date timestamptz, ends_at timestamptz,
              location text, invite_code text, background_url text, max_guests integer)
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
    select e.id, e.host_id, e.title, e.description, e.motto, e.dresscode, e.event_date,
           e.ends_at,
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

-- Siehe Punkt 2 oben: diese drei gingen mit dem DROP verloren und muessen zurueck.
grant execute on function public.get_party_by_invite_code(text)
  to anon, authenticated, service_role;
