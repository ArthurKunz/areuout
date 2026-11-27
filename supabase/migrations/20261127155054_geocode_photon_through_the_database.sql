-- Der Party-Agent findet seit dem Lauf vom 2026-11-23 keine Entwuerfe mehr: Photon antwortet
-- den Edge Functions mit HTTP 403 (ihre Adressen teilen sich viele Projekte), der Datenbank
-- aber normal (getestet 2026-11-27). Jedes gepruefte Event wurde mit "Adresse nicht
-- gefunden (Photon: HTTP 403)" verworfen.
--
-- pg_net taugt als Umweg nicht: der Agent wird selbst ueber pg_net gestartet, und der
-- pg_net-Worker holt neue Anfragen erst ab, wenn dieser Aufruf fertig ist (Testlauf
-- 2026-11-27, alle Antworten kamen erst nach dem Ende des Laufs).
--
-- Fix: die Erweiterung http (synchron, in der eigenen Sitzung) und eine Funktion, die nur
-- Photon abfragen darf. party-agent ruft sie ueber SUPABASE_DB_URL auf, wenn der direkte Weg
-- scheitert. Gesendet wird nur die oeffentliche Adresse eines Events. Von Arthur freigegeben.
--
-- Additiv: neue Erweiterung im Schema extensions, neue Funktion im Schema private (fuer die
-- API-Rollen gesperrt). Die App im App Store merkt davon nichts.

create extension if not exists http with schema extensions;

create or replace function private.photon_get(p_url text)
returns table (status integer, content text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_url !~ '^https://photon\.komoot\.io/api/\?' then
    raise exception 'Nur Photon-Anfragen erlaubt.' using errcode = '22023';
  end if;

  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '10000');

  return query
  select r.status, r.content
  from extensions.http((
    'GET',
    p_url,
    array[extensions.http_header('User-Agent', 'areuout-party-agent (+https://www.areuout.de)')],
    null,
    null
  )::extensions.http_request) r;
end;
$$;

revoke all on function private.photon_get(text) from public, anon, authenticated, service_role;
