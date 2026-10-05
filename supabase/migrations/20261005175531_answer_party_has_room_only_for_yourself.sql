-- answer_party_has_room_only_for_yourself
--
-- Rollback: re-apply party_has_room from
-- 20260811150000_scope_attendee_rpcs_and_enforce_capacity.sql (on main) as CREATE OR REPLACE.
--
-- party_has_room answered for any user id. On a full party it returned true for someone
-- holding a 'going' place and false for everyone else, and authenticated may call it,
-- so any signed-in user could ask whether user X holds a place on party Y. Step 8 lets
-- the app call it for the `Diese Party ist voll` button, so it now insists on the
-- caller's own id: a foreign id always gets false. Every caller already passes its own
-- id (rsvps_insert_authenticated, rsvps_update_own, request_to_join); the capacity
-- trigger and accept_join_request do not call it. Same signature, language and
-- search_path, so grants, policies and the generated types stay.
--
-- Verified 2026-10-05 as real users, rolled back: own id unchanged (true for the guest
-- with a place on a full party, false for anyone else on it), a foreign id false, RSVP
-- insert and update and request_to_join + accept_join_request still pass on a party with
-- room; advisors unchanged (3 anon, 28 authenticated).

create or replace function public.party_has_room(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    when p_user_id is distinct from (select auth.uid()) then false
    when (select e.max_guests from events e where e.id = p_event_id) is null then true
    when exists (
      select 1 from rsvps r
      where r.event_id = p_event_id and r.user_id = p_user_id and r.status = 'going'
    ) then true
    else (select count(*) from rsvps r where r.event_id = p_event_id and r.status = 'going')
         < (select e.max_guests from events e where e.id = p_event_id)
  end;
$function$;
