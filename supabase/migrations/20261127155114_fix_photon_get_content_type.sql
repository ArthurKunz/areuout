-- private.photon_get aus 20261127155054 scheiterte beim ersten Aufruf: extensions.http gibt
-- content als varchar zurueck, die Funktion verspricht text ("structure of query does not
-- match function result type"). Fix: content::text. Sonst unveraendert.
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
  select r.status, r.content::text
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
