-- Zweiter Teil der Umschlüsselung. Die Einladungsseite fragt seit dieser Änderung
-- get_event_host_by_invite_code und get_rsvp_counts_by_status_by_invite_code —
-- die beiden UUID-Fassungen braucht dort niemand mehr.
--
-- anon verliert sie damit ganz: Eine Party-UUID allein soll nichts mehr über eine
-- Party verraten. Sie ist kein Geheimnis, sie steht in jeder Hintergrundbild-Adresse.
--
-- Fuer authenticated bleiben beide, aber nicht mehr blank: Sie bekommen dieselbe
-- Mitgliedschaftspruefung, die auch die SELECT-Policy auf events verlangt.
-- is_party_member deckt den Gastgeber mit ab (die Funktion prueft host_id ODER eine
-- Zeile in rsvps), ein Gast ohne Zusage und ein Unbeteiligter bekommen nichts.
-- Genutzt werden beide nur noch von der Detailseite, und dorthin kommt ausschliesslich,
-- wer die Party ohnehin sehen darf.
create or replace function public.get_event_host(p_event_id uuid)
returns table(firstname text, lastname text, avatar_url text, avatar_color text)
language sql
security definer
set search_path to 'public'
as $function$
  select p.firstname, p.lastname, p.avatar_url, p.avatar_color
  from events e
  join profiles p on p.id = e.host_id
  where e.id = p_event_id
    and is_party_member(e.id);
$function$;

create or replace function public.get_rsvp_counts_by_status(p_event_id uuid)
returns table(going_count integer, maybe_count integer, not_going_count integer)
language sql
security definer
set search_path to 'public'
as $function$
  select
    count(*) filter (where r.status = 'going')::integer,
    count(*) filter (where r.status = 'maybe')::integer,
    count(*) filter (where r.status = 'not_going')::integer
  from rsvps r
  where r.event_id = p_event_id
    and is_party_member(p_event_id);
$function$;

revoke execute on function public.get_event_host(uuid) from public, anon;
revoke execute on function public.get_rsvp_counts_by_status(uuid) from public, anon;
grant execute on function public.get_event_host(uuid) to authenticated;
grant execute on function public.get_rsvp_counts_by_status(uuid) to authenticated;
