-- Die Bremse für get_party_by_invite_code braucht einen Zähler. Er gehört NICHT nach
-- public: alles dort liegt hinter der REST-API, und ein Zähler, den jeder auslesen oder
-- leeren kann, ist keiner. Supabase liefert nur die in den API-Einstellungen genannten
-- Schemata aus (public, graphql_public) — ein eigenes Schema ist damit unerreichbar.
create schema if not exists private;

revoke all on schema private from anon, authenticated;

-- Eine Zeile je Anrufer, an Ort und Stelle fortgeschrieben. Die Tabelle wächst also mit
-- der Zahl der IP-Adressen, die einen falschen Code probiert haben, nicht mit der Zahl
-- der Versuche.
create table if not exists private.invite_lookup_misses (
  client_ip    text primary key,
  window_start timestamptz not null,
  misses       integer not null default 0
);

revoke all on table private.invite_lookup_misses from anon, authenticated;

comment on table private.invite_lookup_misses is
  'Fehlversuche je IP und Minute für get_party_by_invite_code. Gezählt werden nur Aufrufe, die keinen Code treffen — wer einen gültigen Link öffnet, taucht hier nie auf.';
