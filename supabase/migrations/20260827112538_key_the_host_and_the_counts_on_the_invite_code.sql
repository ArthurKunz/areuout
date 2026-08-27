-- Die Einladungsseite braucht für einen Besucher ohne Konto drei Dinge: die Party, den
-- Namen des Gastgebers und die Zahl der Zusagen. Die Party holt sie über den
-- Einladungscode — get_event_host und get_rsvp_counts_by_status nahmen dagegen die
-- Party-UUID und prüften nichts. Wer eine solche UUID hatte, bekam ohne Konto den
-- vollen Namen des Gastgebers; und Party-UUIDs stehen in jeder Hintergrundbild-Adresse
-- ({host_id}/{party_id}/background.jpg).
--
-- Das widerspricht dem Satz, auf dem die ganze Konstruktion steht: der Einladungscode
-- ist das einzige Geheimnis. Diese beiden Funktionen stellen das her — gleicher Körper
-- wie die Originale, nur über invite_code statt über die id gefunden.
create or replace function public.get_event_host_by_invite_code(p_invite_code text)
returns table(firstname text, lastname text, avatar_url text, avatar_color text)
language sql
security definer
set search_path to 'public'
as $function$
  select p.firstname, p.lastname, p.avatar_url, p.avatar_color
  from events e
  join profiles p on p.id = e.host_id
  where e.invite_code = p_invite_code;
$function$;

create or replace function public.get_rsvp_counts_by_status_by_invite_code(p_invite_code text)
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
  join events e on e.id = r.event_id
  where e.invite_code = p_invite_code;
$function$;

-- Erst PUBLIC das Recht nehmen, dann ausdrücklich vergeben. Ein blosses revoke von
-- anon liefe ins Leere, weil anon von PUBLIC erbt — genau daran ist am 27.08. schon
-- einmal ein Revoke gescheitert.
revoke execute on function public.get_event_host_by_invite_code(text) from public;
revoke execute on function public.get_rsvp_counts_by_status_by_invite_code(text) from public;
grant execute on function public.get_event_host_by_invite_code(text) to anon, authenticated;
grant execute on function public.get_rsvp_counts_by_status_by_invite_code(text) to anon, authenticated;
