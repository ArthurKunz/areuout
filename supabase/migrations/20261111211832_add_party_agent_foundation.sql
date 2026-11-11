-- Party Agent, Schritt 2, Migration 1: das Fundament (Vault: Party Agent Database Review,
-- Entscheidungen D1 und D2). Nur neue Objekte, nichts Bestehendes wird geändert.
--
-- D1: Entwürfe liegen in private.agent_candidates und nie in public.events. Das private
-- Schema ist für anon und authenticated unerreichbar (kein USAGE, SCHEMA.md 4 und 8), also
-- kann kein Entwurf auf der Karte oder in einer Funktion auftauchen.
-- D2: Ein Agent-Event ist eine Party, deren host_id der areuout-Systemaccount ist. Den kann
-- niemand fälschen, weil RLS host_id = auth.uid() verlangt. Die Agent-Details liegen in
-- public.agent_event_details, ohne Schreibrecht für irgendeine API-Rolle.

-- Einstellungen: genau eine Zeile, die id des Systemaccounts. Wird nach dem Anlegen des
-- Accounts von Hand gefüllt. Ein Löschen des Profils wird verweigert.
create table private.agent_config (
  id boolean primary key default true check (id),
  system_account_id uuid not null references public.profiles (id) on delete restrict
);

-- Admins (D2 im Review, Scope: keine Rollen-Spalte auf profiles). Arthurs id wird einmal
-- im SQL Editor eingetragen.
create table private.admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now()
);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.admins a where a.user_id = (select auth.uid()));
$$;

create or replace function private.agent_system_account()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.system_account_id from private.agent_config c where c.id;
$$;

create or replace function private.is_agent_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id and e.host_id = private.agent_system_account()
  );
$$;

-- Ein Lauf pro Kategorie. Kosten und Zahlen für den Monatsblick (Schritt 7).
create table private.agent_runs (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('club', 'concert', 'festival', 'open_air')),
  model text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  found integer not null default 0 check (found >= 0),
  verified integer not null default 0 check (verified >= 0),
  discarded integer not null default 0 check (discarded >= 0),
  duplicates integer not null default 0 check (duplicates >= 0),
  drafts integer not null default 0 check (drafts >= 0),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  web_searches integer not null default 0 check (web_searches >= 0),
  cost_usd numeric(10, 4) check (cost_usd is null or cost_usd >= 0),
  error text check (error is null or char_length(error) <= 2000)
);

-- Quell-Links entfernter Events: der Agent fügt sie nie wieder ein.
create table private.agent_blocked_sources (
  source_url text primary key check (source_url ~ '^https?://' and char_length(source_url) <= 2000),
  blocked_at timestamptz not null default now(),
  reason text not null check (reason in ('organizer_request', 'admin'))
);

-- Alles, was der Agent findet: neue Events, Änderungen, Absagen (D1).
-- Werte und Grenzen wie in public.events, damit die Freigabe nie an einem CHECK scheitert.
create table private.agent_candidates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('new', 'change', 'cancel')),
  status text not null default 'draft' check (status in ('draft', 'approved', 'discarded', 'expired')),
  -- Bei change und cancel: das betroffene Event. Bei new: nach der Freigabe das neue Event.
  event_id uuid references public.events (id) on delete cascade,
  run_id uuid references private.agent_runs (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 60),
  starts_at timestamptz not null,
  ends_at timestamptz check (ends_at is null or ends_at > starts_at),
  -- Tag des Beginns in Leipzig: Duplikat-Regel (gleicher Link und gleiches Datum).
  starts_on date not null,
  location text not null check (char_length(btrim(location)) between 1 and 500),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  event_type text not null check (event_type in ('club', 'concert', 'festival', 'open_air', 'other')),
  price numeric check (price is null or (price > 0 and price <= 9999.99)),
  organizer_name text check (organizer_name is null or char_length(organizer_name) <= 200),
  website_url text check (website_url is null or (website_url ~ '^https://' and char_length(website_url) <= 500)),
  source_url text not null check (source_url ~ '^https?://' and char_length(source_url) <= 2000),
  description text not null check (char_length(btrim(description)) between 1 and 500),
  background_url text not null check (background_url ~ '^https://desolyjfpbxlydbdqixp\.supabase\.co/storage/v1/object/public/event-backgrounds/'),
  -- Wahrscheinliches Duplikat: Hinweis "Vielleicht schon vorhanden" im Admin-Screen.
  duplicate_of uuid references public.events (id) on delete set null,
  -- Nur bei change: welche Felder sich ändern ({"starts_at": ..., "price": ...}).
  changes jsonb check (changes is null or jsonb_typeof(changes) = 'object'),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint agent_candidates_event_for_proposals check (kind = 'new' or event_id is not null),
  constraint agent_candidates_changes_only_for_change check ((kind = 'change') = (changes is not null))
);

-- Sicheres Duplikat: derselbe Link am selben Tag ist nur einmal als offener oder
-- freigegebener Vorschlag erlaubt (Wiederholungs-Partys teilen sich oft eine Seite).
create unique index agent_candidates_source_once_per_day
  on private.agent_candidates (source_url, starts_on)
  where kind = 'new' and status in ('draft', 'approved');

create index agent_candidates_open on private.agent_candidates (starts_at) where status = 'draft';

-- Details veröffentlichter Agent-Events (D2). Eine Zeile pro Agent-Event, fällt mit dem
-- Event. RLS an, keine Policy, keine Rechte für anon und authenticated: gelesen wird nur
-- über get_agent_event_details, geschrieben nur von SECURITY-DEFINER-Funktionen und der
-- Edge Function (service role).
create table public.agent_event_details (
  event_id uuid primary key references public.events (id) on delete cascade,
  source_url text not null check (source_url ~ '^https?://' and char_length(source_url) <= 2000),
  starts_on date not null,
  organizer_name text check (organizer_name is null or char_length(organizer_name) <= 200),
  last_checked_at timestamptz,
  cancelled_at timestamptz,
  constraint agent_event_details_source_once_per_day unique (source_url, starts_on)
);

alter table public.agent_event_details enable row level security;
revoke all on table public.agent_event_details from public, anon, authenticated;

-- Was die App über ein Agent-Event zeigen darf: Quelle, Veranstalter, abgesagt.
-- Nur für veröffentlichte, öffentliche Agent-Events, die noch sichtbar sind.
create or replace function public.get_agent_event_details(p_event_id uuid)
returns table (source_url text, organizer_name text, cancelled_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select d.source_url, d.organizer_name, d.cancelled_at
  from public.agent_event_details d
  join public.events e on e.id = d.event_id
  where d.event_id = p_event_id
    and e.is_public
    and e.host_id = private.agent_system_account()
    and private.party_visible_until(e.event_date, e.ends_at) > now()
    and (select auth.uid()) is not null;
$$;

revoke execute on function public.get_agent_event_details(uuid) from public, anon;
grant execute on function public.get_agent_event_details(uuid) to authenticated;

-- Das private Schema ist schon unerreichbar (kein USAGE). Trotzdem keine Rechte auf den
-- Tabellen, falls das je geändert wird.
revoke all on table private.agent_config, private.admins, private.agent_runs,
  private.agent_blocked_sources, private.agent_candidates from public, anon, authenticated;

revoke execute on function private.is_admin() from public, anon, authenticated;
revoke execute on function private.agent_system_account() from public, anon, authenticated;
revoke execute on function private.is_agent_event(uuid) from public, anon, authenticated;
