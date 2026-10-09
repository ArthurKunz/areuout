-- get_party_by_invite_code gibt keine Adresse mehr heraus (Schritt 12 des Redesigns).
--
-- Die Funktion ist fuer anon freigegeben: wer nur den Link hatte, bekam ohne Konto die
-- volle Anschrift einer privaten Party, bis sechs Stunden nach dem Beginn. Die neue App
-- liest location hier nirgends: die Einladungsseite braucht id und host_id, die
-- Link-Vorschau Titel, Datum, Beschreibung und Bild. Die Adresse kommt fuer einen
-- angemeldeten Gast aus get_party_detail, nachdem diese Funktion sein invite_opens
-- geschrieben hat, und dort gilt die 24-Stunden-Regel. Mit der Spalte faellt auch
-- c_assumed_hours weg, die sechs Stunden, die nur sie noch brauchte.
--
-- Erst NACH dem Merge in main anwenden, wenn das Vercel-Deployment auf Ready steht:
-- die alte App zeigt die Adresse aus genau dieser Spalte.
--
-- DROP + CREATE wie in 20261008203433_add_an_optional_price_to_a_party.sql, weil eine
-- RETURNS-TABLE-Form nicht per CREATE OR REPLACE geaendert werden kann. Vorher geprueft:
-- nichts in pg_depend haengt an der Funktion. Deshalb KEIN CASCADE. Zwei Fallen, wie
-- dort:
--   1. search_path bleibt 'public', nicht '': der Rumpf nennt events unqualifiziert.
--   2. Der DROP nimmt die Grants mit. Sie kommen unten zurueck, fuer anon und
--      authenticated (und service_role), aber nicht mehr fuer PUBLIC (SCHEMA.md,
--      offene Frage 4). Ohne das GRANT fuer anon ist die Einladungsseite ohne Konto tot.
--
-- Der Rumpf ist aus pg_get_functiondef der Live-Datenbank uebernommen; geaendert sind
-- nur die fehlende Spalte location und die fehlende Konstante. Bricht ab, wenn der Rumpf
-- auf der Datenbank nicht mehr der vom 09.10.2026 ist. Alles in einer Transaktion.

begin;

do $$
begin
  if (select md5(prosrc) from pg_proc
      where oid = 'public.get_party_by_invite_code(text)'::regprocedure) <> '6f7c8334a6c1ca3818dec1a3c05ac77a' then
    raise exception 'get_party_by_invite_code changed since 2026-10-09, compare before applying';
  end if;
end;
$$;

drop function public.get_party_by_invite_code(text);
CREATE FUNCTION public.get_party_by_invite_code(p_invite_code text)
 RETURNS TABLE(id uuid, host_id uuid, title text, description text, motto text, dresscode text, event_date timestamp with time zone, ends_at timestamp with time zone, invite_code text, background_url text, max_guests integer, price numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c_limit constant integer := 30;
  v_ip text;
  v_misses integer;
  v_event_id uuid;
  v_matched boolean;
begin
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
      raise sqlstate 'PT429' using message = 'Zu viele Versuche. Warte einen Moment.';
    end if;
  end if;

  return query
    select e.id, e.host_id, e.title, e.description, e.motto, e.dresscode, e.event_date,
           e.ends_at, e.invite_code, e.background_url, e.max_guests, e.price
    from events e
    where e.invite_code = p_invite_code;

  -- Snapshot immediately: the miss-tracking INSERT/DELETE below would otherwise
  -- overwrite FOUND before the invite_opens check at the bottom reads it.
  v_matched := found;

  if v_matched then
    select e.id into v_event_id from events e where e.invite_code = p_invite_code;
  end if;

  if not v_matched and v_ip is not null then
    insert into private.invite_lookup_misses as m (client_ip, window_start, misses)
    values (v_ip, date_trunc('minute', now()), 1)
    on conflict (client_ip) do update
      set misses = case
                     when m.window_start = date_trunc('minute', now()) then m.misses + 1
                     else 1
                   end,
          window_start = date_trunc('minute', now());

    if random() < 0.01 then
      delete from private.invite_lookup_misses
      where window_start < now() - interval '1 hour';
    end if;
  end if;

  if v_matched and auth.uid() is not null then
    insert into private.invite_opens (event_id, user_id)
    values (v_event_id, auth.uid())
    on conflict (event_id, user_id) do nothing;
  end if;
end;
$function$
;
alter function public.get_party_by_invite_code(text) owner to postgres;
revoke all on function public.get_party_by_invite_code(text) from public;
grant execute on function public.get_party_by_invite_code(text) to anon, authenticated, service_role;

commit;
