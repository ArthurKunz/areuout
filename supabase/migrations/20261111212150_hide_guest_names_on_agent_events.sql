-- Party Agent, Schritt 2, Migration 3: bei Agent-Events gibt keine Funktion Gästenamen
-- heraus (Vault: Party Agent section 8 "Display", Database Review P3). Öffentliche Events
-- stehen jedem Fremden offen; eine Namensliste zeigte allen, wer hingeht. Die Zahl kommt
-- weiter aus den Zähl-Funktionen.
-- Jede Funktion bleibt in Form und Rechten gleich (create or replace), nur eine Bedingung
-- kommt dazu: private.is_agent_event. Für normale Partys ändert sich nichts.

create or replace function public.get_party_guest_list(p_event_id uuid)
 returns table(user_id uuid, firstname text, lastname text, avatar_url text, avatar_color text, status text)
 language sql
 stable security definer
 set search_path to ''
as $function$
  WITH rows AS (
    SELECT p.id, p.firstname, p.lastname, p.avatar_url, p.avatar_color, r.status
    FROM public.rsvps r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.event_id = p_event_id
    UNION ALL
    SELECT p.id, p.firstname, p.lastname, p.avatar_url, p.avatar_color, 'host'
    FROM public.events e
    JOIN public.profiles p ON p.id = e.host_id
    WHERE e.id = p_event_id
      AND NOT EXISTS (SELECT 1 FROM public.rsvps r WHERE r.event_id = p_event_id AND r.user_id = e.host_id)
  )
  SELECT rows.id, rows.firstname, rows.lastname, rows.avatar_url, rows.avatar_color, rows.status
  FROM rows
  WHERE NOT private.has_blocked((SELECT auth.uid()), rows.id)
    AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event_id AND private.has_blocked((SELECT auth.uid()), e.host_id))
    AND NOT private.is_agent_event(p_event_id)
  ORDER BY CASE status WHEN 'host' THEN 0 WHEN 'going' THEN 1 WHEN 'maybe' THEN 2 ELSE 3 END, firstname;
$function$;

create or replace function public.get_party_guests(p_event_id uuid)
 returns table(user_id uuid, firstname text, lastname text, avatar_url text, avatar_color text, status text)
 language sql
 stable security definer
 set search_path to ''
as $function$
  WITH access AS (
    SELECT private.has_exact_access(
      p_event_id, (SELECT e.is_public FROM public.events e WHERE e.id = p_event_id)
    ) AS has_access
  ),
  rows AS (
    SELECT p.id, p.firstname, p.lastname, p.avatar_url, p.avatar_color, r.status
    FROM public.rsvps r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.event_id = p_event_id
    UNION ALL
    SELECT p.id, p.firstname, p.lastname, p.avatar_url, p.avatar_color, 'host'
    FROM public.events e
    JOIN public.profiles p ON p.id = e.host_id
    WHERE e.id = p_event_id
      AND NOT EXISTS (SELECT 1 FROM public.rsvps r WHERE r.event_id = p_event_id AND r.user_id = e.host_id)
  )
  SELECT
    rows.id, rows.firstname,
    private.visible_lastname(rows.lastname, (SELECT has_access FROM access)),
    rows.avatar_url, rows.avatar_color, rows.status
  FROM rows
  WHERE NOT private.is_agent_event(p_event_id)
  ORDER BY CASE status WHEN 'host' THEN 0 WHEN 'going' THEN 1 WHEN 'maybe' THEN 2 ELSE 3 END, firstname;
$function$;

create or replace function public.get_event_attendees(p_event_id uuid)
 returns table(user_id uuid, firstname text, lastname text, avatar_url text, avatar_color text, status text)
 language sql
 security definer
 set search_path to 'public'
as $function$
  with rows as (
    select p.id, p.firstname, p.lastname, p.avatar_url, p.avatar_color, r.status
    from rsvps r
    join profiles p on p.id = r.user_id
    where r.event_id = p_event_id and r.status in ('going', 'maybe', 'not_going')
    union all
    select p.id, p.firstname, p.lastname, p.avatar_url, p.avatar_color, 'host'
    from events e
    join profiles p on p.id = e.host_id
    where e.id = p_event_id
      and not exists (
        select 1 from rsvps r
        where r.event_id = p_event_id and r.user_id = e.host_id
      )
  )
  select *
  from rows
  where public.is_party_member(p_event_id)
    and not private.is_agent_event(p_event_id)
  order by
    case status when 'host' then 0 when 'going' then 1 when 'maybe' then 2 else 3 end,
    firstname;
$function$;

create or replace function public.get_event_attendees_for_events(p_event_ids uuid[])
 returns table(event_id uuid, user_id uuid, firstname text, lastname text, avatar_url text, avatar_color text, status text)
 language sql
 security definer
 set search_path to 'public'
as $function$
  with rows as (
    select r.event_id as event_id, p.id as user_id, p.firstname as firstname,
           p.lastname as lastname, p.avatar_url as avatar_url,
           p.avatar_color as avatar_color, r.status as status
    from rsvps r
    join profiles p on p.id = r.user_id
    where r.event_id = any(p_event_ids)
      and r.status in ('going', 'maybe', 'not_going')
    union all
    select e.id, p.id, p.firstname, p.lastname, p.avatar_url, p.avatar_color, 'host'
    from events e
    join profiles p on p.id = e.host_id
    where e.id = any(p_event_ids)
      and not exists (
        select 1 from rsvps r
        where r.event_id = e.id and r.user_id = e.host_id
      )
  )
  select rows.event_id, rows.user_id, rows.firstname, rows.lastname,
         rows.avatar_url, rows.avatar_color, rows.status
  from rows
  where public.is_party_member(rows.event_id)
    and not private.is_agent_event(rows.event_id)
  order by
    rows.event_id,
    case rows.status when 'host' then 0 when 'going' then 1 when 'maybe' then 2 else 3 end,
    rows.firstname;
$function$;

create or replace function public.get_event_attendees_by_invite_code(p_invite_code text)
 returns table(user_id uuid, firstname text, lastname text, avatar_url text, avatar_color text, status text)
 language sql
 security definer
 set search_path to 'public'
as $function$
  with party as (
    select e.id from events e
    where e.invite_code = p_invite_code
      and not private.is_agent_event(e.id)
  ),
  rows as (
    select p.id, p.firstname, p.lastname, p.avatar_url, p.avatar_color, r.status
    from rsvps r
    join profiles p on p.id = r.user_id
    where r.event_id = (select id from party) and r.status in ('going', 'maybe', 'not_going')
    union all
    select p.id, p.firstname, p.lastname, p.avatar_url, p.avatar_color, 'host'
    from events e
    join profiles p on p.id = e.host_id
    where e.id = (select id from party)
      and not exists (
        select 1 from rsvps r
        where r.event_id = e.id and r.user_id = e.host_id
      )
  )
  select *
  from rows
  order by
    case status when 'host' then 0 when 'going' then 1 when 'maybe' then 2 else 3 end,
    firstname;
$function$;
