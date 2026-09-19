-- Die Mitbring-Liste: der Gastgeber schreibt auf, was die Party braucht, und jeder
-- Gast nimmt sich genau einen Gegenstand.
--
-- Anders als die Fragen bekommt dieses Feature eigene Tabellen. Die beiden Regeln, die
-- es ausmachen, sind zwei UNIQUE-Constraints, und die gibt es auf keiner vorhandenen
-- Tabelle:
--
--   1. Ein Gegenstand gehoert genau einer Person  -> unique (item_id)
--   2. Eine Person haelt hoechstens einen          -> unique (event_id, claimed_by)
--      Gegenstand pro Party
--
-- Punkt 2 ist der Grund, warum event_id auf der Beanspruchung liegt, obwohl es ueber
-- item_id erreichbar waere: ein UNIQUE-Constraint kann nur Spalten derselben Zeile
-- pruefen.
--
-- Diese Verdopplung ist aber genau die Luecke, durch die sonst jemand die Regel
-- umginge: mit einer fremden event_id auf der eigenen Beanspruchung haelt man zwei
-- Gegenstaende derselben Party. Deshalb der ZUSAMMENGESETZTE Fremdschluessel auf
-- (item_id, event_id) — er laesst nur das Paar zu, das der Gegenstand selbst traegt.
-- Dieselbe Konstruktion wie bei pool_responses, und dasselbe Prinzip: RLS entscheidet,
-- WER eine Zeile schreibt, nie WAS darin steht. Der anon-Key liegt im Browser-Bundle.
--
-- Die Obergrenze von 30 Gegenstaenden steht bewusst NICHT hier. Sie ist eine Regel der
-- Oberflaeche, wie POOLS_MAX, und keine, an der die Daten kaputtgehen.

create table public.mitbring_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now(),
  -- Das Zehnfache des UI-Limits von 40, dieselbe Rechnung wie bei den Polls-Spalten:
  -- die Oberflaeche zieht die enge Grenze, die Datenbank faengt nur das Absurde ab.
  constraint mitbring_items_label_length_check check (length(label) <= 400),
  -- Der zusammengesetzte Fremdschluessel unten referenziert genau dieses Paar, und
  -- Postgres verlangt dafuer einen eigenen UNIQUE-Schluessel auf beide Spalten.
  constraint mitbring_items_id_event_id_key unique (id, event_id)
);

create table public.mitbring_claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null,
  event_id uuid not null,
  claimed_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint mitbring_claims_item_fkey
    foreign key (item_id, event_id) references public.mitbring_items (id, event_id)
    on delete cascade,
  constraint mitbring_claims_item_id_key unique (item_id),
  constraint mitbring_claims_event_id_claimed_by_key unique (event_id, claimed_by)
);

-- Ein UNIQUE-Index serialisiert wirklich; eine Policy kann das nicht. Zwei Gaeste, die
-- im selben Moment auf denselben Gegenstand tippen, laufen genau hier auseinander —
-- einer gewinnt, der andere bekommt einen Fehler und die Oberflaeche nimmt die
-- Beanspruchung zurueck. SCHEMA.md Abschnitt 3.

-- Fremdschluessel ohne Index sind der Klassiker. item_id und event_id decken die
-- beiden UNIQUE-Indizes bereits ab, claimed_by und items.event_id nicht.
create index mitbring_items_event_id_idx on public.mitbring_items (event_id);
create index mitbring_claims_claimed_by_idx on public.mitbring_claims (claimed_by);

alter table public.mitbring_items enable row level security;
alter table public.mitbring_claims enable row level security;

-- Jede Policy nennt ihre Rolle ausdruecklich. anon haelt auf jeder Tabelle die
-- Supabase-Standardgrants; was anon fernhaelt, ist allein, dass keine Policy fuer ihn
-- existiert. Eine einzige Policy `to public` oeffnet die Tabelle sofort der ganzen
-- Welt. SCHEMA.md Abschnitt 2.

create policy "mitbring_items_select_member"
  on public.mitbring_items for select to authenticated
  using (is_party_member(event_id));

create policy "mitbring_items_insert_host"
  on public.mitbring_items for insert to authenticated
  with check ((select e.host_id from public.events e where e.id = mitbring_items.event_id) = auth.uid());

create policy "mitbring_items_update_host"
  on public.mitbring_items for update to authenticated
  using ((select e.host_id from public.events e where e.id = mitbring_items.event_id) = auth.uid())
  with check ((select e.host_id from public.events e where e.id = mitbring_items.event_id) = auth.uid());

create policy "mitbring_items_delete_host"
  on public.mitbring_items for delete to authenticated
  using ((select e.host_id from public.events e where e.id = mitbring_items.event_id) = auth.uid());

create policy "mitbring_claims_select_member"
  on public.mitbring_claims for select to authenticated
  using (is_party_member(event_id));

-- Fuer sich selbst, und nur auf einer Party, zu der man gehoert. Der Gastgeber zaehlt
-- als Mitglied und darf deshalb selbst beanspruchen — dieselbe Ausnahme wie bei den
-- Umfragen, wo er in seiner eigenen Umfrage abstimmt.
create policy "mitbring_claims_insert_own"
  on public.mitbring_claims for insert to authenticated
  with check (claimed_by = auth.uid() and is_party_member(event_id));

-- Loslassen darf man das Eigene. Der Gastgeber darf jede Beanspruchung loesen, als
-- Moderation — fuer den Gast, der sich nicht mehr meldet.
create policy "mitbring_claims_delete_own_or_host"
  on public.mitbring_claims for delete to authenticated
  using (
    claimed_by = auth.uid()
    or (select e.host_id from public.events e where e.id = mitbring_claims.event_id) = auth.uid()
  );

-- Kein UPDATE auf mitbring_claims. Beanspruchen ist ein INSERT, Loslassen ein DELETE;
-- was nicht vorgesehen ist, bekommt auch keine Policy.
