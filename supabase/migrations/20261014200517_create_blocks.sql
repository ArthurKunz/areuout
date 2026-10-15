-- Blockieren, Teil 1: die Tabelle, die zwei Hilfsfunktionen und die Liste der
-- Blockierten (Schritt 13b, App Store 1.2 und Google Play UGC).
--
-- public.blocks: eine Zeile heisst "blocker hat blocked blockiert". Beide FKs mit
-- ON DELETE CASCADE, damit ein geloeschtes Konto seine Blockierungen in beide Richtungen
-- mitnimmt (SCHEMA.md Abschnitt 7).
--
-- Lesen: nur die eigenen Zeilen als Blockierender. Der Blockierte sieht nie, dass er
-- blockiert ist. Schreiben: kein INSERT fuer authenticated und keine INSERT-Policy,
-- Zeilen kommen nur ueber block_user, das im selben Zug Anfragen, Zusagen und
-- invite_opens zwischen den beiden loescht (wie join_requests). DELETE ueber die Policy
-- oder unblock_user. anon bekommt nichts (SCHEMA.md Abschnitt 2).
--
-- Die Regel steht genau einmal: private.has_blocked(blocker, blocked). Die Lesefunktionen
-- verstecken einseitig mit has_blocked(auth.uid(), x), damit der Blockierte nichts merkt.
-- Die Sperren (request_to_join, can_rsvp_to_event, has_party_access) fragen
-- private.is_blocked_between(a, b), das in beide Richtungen auf has_blocked aufbaut.
--
-- Additiv: solange blocks leer ist, aendert sich nichts.

begin;

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blocks_pkey primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create index blocks_blocked_id_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

create policy blocks_select_own on public.blocks
  for select to authenticated
  using (blocker_id = (select auth.uid()));

create policy blocks_delete_own on public.blocks
  for delete to authenticated
  using (blocker_id = (select auth.uid()));

revoke all on public.blocks from anon;
revoke insert, update, truncate, references, trigger on public.blocks from authenticated;

create function private.has_blocked(p_blocker uuid, p_blocked uuid)
 returns boolean
 language sql
 stable
 set search_path to ''
as $function$
  select exists (
    select 1 from public.blocks b
    where b.blocker_id = p_blocker and b.blocked_id = p_blocked
  );
$function$;

create function private.is_blocked_between(p_a uuid, p_b uuid)
 returns boolean
 language sql
 stable
 set search_path to ''
as $function$
  select private.has_blocked(p_a, p_b) or private.has_blocked(p_b, p_a);
$function$;

revoke all on function private.has_blocked(uuid, uuid) from public;
revoke all on function private.is_blocked_between(uuid, uuid) from public;

-- profiles ist nur fuer die eigene Zeile lesbar, deshalb eine Funktion: Name und Bild
-- der Leute, die man selbst blockiert hat, sonst nichts.
create function public.get_my_blocked_users()
 returns table(id uuid, firstname text, lastname text, avatar_url text, avatar_color text)
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select p.id, p.firstname, p.lastname, p.avatar_url, p.avatar_color
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = (select auth.uid())
  order by b.created_at desc;
$function$;

revoke all on function public.get_my_blocked_users() from public, anon;
grant execute on function public.get_my_blocked_users() to authenticated, service_role;

commit;
