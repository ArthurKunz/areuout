-- Push, Teil 1: die Tabelle fuer die Geraete-Token und die Funktion, die sie schreibt
-- (Schritt 13d, Checkliste 16, Apple 4.2).
--
-- public.push_tokens: eine Zeile heisst "dieses Geraet gehoert dieser Person". Der Token
-- ist der APNs-Geraete-Token als Hex-Text und der Primaerschluessel: ein Geraet hat genau
-- einen Besitzer. Meldet sich auf demselben Geraet jemand anderes an, wechselt die Zeile
-- den Besitzer (register_push_token).
--
-- user_id zeigt mit ON DELETE CASCADE auf profiles: ein geloeschtes Konto nimmt seine
-- Token mit (SCHEMA.md Abschnitt 7), delete_self bleibt unveraendert.
--
-- Lesen und Loeschen: nur die eigenen Zeilen (Abmelden loescht den Token dieses Geraets).
-- Schreiben: kein INSERT und kein UPDATE fuer authenticated, Zeilen kommen nur ueber
-- register_push_token. anon bekommt nichts (SCHEMA.md Abschnitt 2). Nicht in realtime.
--
-- register_push_token haelt hoechstens 10 Token pro Person (die aeltesten fliegen raus),
-- damit der anon-Key im Browser-Bundle keinen Speicher fuellen kann.
--
-- Verschickt wird noch nichts: diese Migration baut weder einen Trigger noch einen
-- HTTP-Aufruf. Additiv: solange push_tokens leer ist, aendert sich nichts.

begin;

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null default 'ios',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_tokens_token_format check (token ~ '^[0-9a-f]{64,200}$'),
  constraint push_tokens_platform_check check (platform in ('ios'))
);

create index push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy push_tokens_select_own on public.push_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy push_tokens_delete_own on public.push_tokens
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.push_tokens from anon;
revoke insert, update, truncate, references, trigger on public.push_tokens from authenticated;

create function public.register_push_token(p_token text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_token text := lower(coalesce(p_token, ''));
begin
  if v_uid is null then
    raise exception 'register_push_token: not signed in' using errcode = '42501';
  end if;

  if v_token !~ '^[0-9a-f]{64,200}$' then
    raise exception 'register_push_token: not a device token' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('push_tokens:' || v_uid::text));

  -- Das Geraet gehoerte bisher jemand anderem (Abmelden ohne Abmelden-Knopf, Konto
  -- gewechselt): die alte Zeile geht, damit die alte Person dort nichts mehr bekommt.
  delete from public.push_tokens pt where pt.token = v_token and pt.user_id <> v_uid;

  insert into public.push_tokens (token, user_id)
  values (v_token, v_uid)
  on conflict (token) do update set updated_at = now();

  delete from public.push_tokens pt
  where pt.token in (
    select o.token from public.push_tokens o
    where o.user_id = v_uid
    order by o.updated_at desc, o.created_at desc
    offset 10
  );
end;
$function$;

revoke all on function public.register_push_token(text) from public, anon;
grant execute on function public.register_push_token(text) to authenticated;

commit;
