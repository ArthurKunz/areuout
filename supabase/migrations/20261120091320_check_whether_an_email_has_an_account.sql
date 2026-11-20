-- Native Redesign, Schritt 0, M5 (Arthur, 2026-11-20): der Login der nativen App fragt
-- erst nach der E-Mail und verzweigt dann (Native Redesign 5.1): Konto da, also Passwort;
-- kein Konto, also Code per Mail und neues Passwort. Supabase verrät das von sich aus nicht.
--
-- Antwort als Text, nicht als Ja/Nein:
--   'new'          kein Konto
--   'password'     Konto mit Passwort
--   'no_password'  Konto nur über Apple oder Google; die App schickt dann zu diesen Knöpfen
--                  oder zu 'Passwort vergessen?'
--
-- Datenschutz: jeder kann damit prüfen, ob eine Adresse bei areuout registriert ist. Von
-- Arthur so gewollt. Bremse wie bei get_party_by_invite_code (20260827104435), aber hier
-- zählt JEDER Aufruf, nicht nur Fehlversuche, weil beide Antworten gleich wertvoll sind:
-- 10 pro IP und Kalenderminute. Ein Mensch tippt nie zehn Adressen in einer Minute.
--
-- Die Zählertabelle liegt in private (nicht über die API erreichbar), ohne RLS, wie
-- private.invite_lookup_misses; nur postgres darf hinein.

create table private.email_check_calls (
  client_ip text primary key,
  window_start timestamptz not null,
  calls integer not null
);

create function public.email_account_status(p_email text)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  c_limit constant integer := 10;
  v_ip text;
  v_calls integer;
  v_has_password boolean;
begin
  if p_email is null or char_length(btrim(p_email)) not between 3 and 320 then
    raise exception 'Email must be 3 to 320 characters' using errcode = 'check_violation';
  end if;

  v_ip := coalesce(
    nullif(current_setting('request.headers', true)::json ->> 'cf-connecting-ip', ''),
    nullif(split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1), '')
  );

  if v_ip is not null then
    select c.calls into v_calls
    from private.email_check_calls c
    where c.client_ip = v_ip
      and c.window_start = date_trunc('minute', now());

    if coalesce(v_calls, 0) >= c_limit then
      raise sqlstate 'PT429' using message = 'Zu viele Versuche. Warte einen Moment.';
    end if;

    insert into private.email_check_calls as c (client_ip, window_start, calls)
    values (v_ip, date_trunc('minute', now()), 1)
    on conflict (client_ip) do update
      set calls = case
                    when c.window_start = date_trunc('minute', now()) then c.calls + 1
                    else 1
                  end,
          window_start = date_trunc('minute', now());

    if random() < 0.01 then
      delete from private.email_check_calls
      where window_start < now() - interval '1 hour';
    end if;
  end if;

  select coalesce(u.encrypted_password, '') <> '' into v_has_password
  from auth.users u
  where lower(u.email) = lower(btrim(p_email))
    and u.deleted_at is null
  limit 1;

  if not found then
    return 'new';
  end if;
  return case when v_has_password then 'password' else 'no_password' end;
end;
$function$;
alter function public.email_account_status(text) owner to postgres;
revoke all on function public.email_account_status(text) from public;
grant execute on function public.email_account_status(text) to anon, authenticated, service_role;
