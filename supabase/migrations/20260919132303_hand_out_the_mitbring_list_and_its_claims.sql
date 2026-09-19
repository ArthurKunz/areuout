-- Zwei Lesewege, wie bei den Umfragen und den Fragen.
--
-- 1. Die Beanspruchungen brauchen Namen und Avatare, und profiles ist nicht frei
--    lesbar. Eine SECURITY-DEFINER-Funktion holt beides in einem Zug — sie umgeht RLS,
--    also steht die Mitgliedspruefung ausdruecklich in der Funktion selbst.
--
-- 2. Die Einladungsseite kommt nicht an mitbring_items: die Tabelle ist auf Mitglieder
--    beschraenkt, und wer die Party noch nicht beantwortet hat, ist keines. Die zweite
--    Funktion gibt die Gegenstaende ueber den Invite-Code heraus — ohne die
--    Beanspruchungen, die bleiben Mitgliedern vorbehalten.
--
-- Beide sind fuer Angemeldete, nicht fuer anon: ohne Konto gibt es den
-- Mitbringen-Abschnitt gar nicht, dieselbe Regel wie bei Umfragen und Fragen.

create function public.get_mitbring_claims_by_event(p_event_id uuid)
returns table(item_id uuid, claimed_by uuid, firstname text, lastname text,
              avatar_url text, avatar_color text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select c.item_id, c.claimed_by, prof.firstname, prof.lastname,
         prof.avatar_url, prof.avatar_color
  from mitbring_claims c
  join profiles prof on prof.id = c.claimed_by
  where c.event_id = p_event_id
    and is_party_member(p_event_id)
  order by c.created_at;
$function$;

create function public.get_party_mitbring_by_invite_code(p_invite_code text)
returns json
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(json_agg(item order by item->>'created_at'), '[]'::json)
  from (
    select json_build_object(
      'id', i.id,
      'event_id', i.event_id,
      'label', i.label,
      'created_at', i.created_at
    ) as item
    from mitbring_items i
    join events e on e.id = i.event_id
    where e.invite_code = p_invite_code
  ) items_json;
$function$;

-- Zwei Schritte, nicht einer. Eine neue Funktion traegt den EXECUTE-Grant fuer PUBLIC
-- von selbst, und anon erbt daraus — ein revoke nur von anon hat hier schon einmal
-- nichts bewirkt und musste nachgeholt werden (20260827100530 / 20260827100549).
revoke execute on function public.get_mitbring_claims_by_event(uuid) from public, anon;
revoke execute on function public.get_party_mitbring_by_invite_code(text) from public, anon;

grant execute on function public.get_mitbring_claims_by_event(uuid) to authenticated;
grant execute on function public.get_party_mitbring_by_invite_code(text) to authenticated;
