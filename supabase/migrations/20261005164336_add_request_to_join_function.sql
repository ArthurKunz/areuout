-- add_request_to_join_function
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.request_to_join(uuid);
--
-- The only way a row gets into join_requests. A policy cannot do this: a stranger cannot
-- read a private events row, the private schema is out of reach from a policy, capacity
-- needs the party's lock, and the refusals should read as sentences the app can show.
--
-- Takes the capacity trigger's lock on the party, then a per-person lock, and refuses:
-- a public party, the host's own party, anyone who already has access (RSVP or opened
-- invite link), a party past private.party_visible_until (D1, the moment it leaves the
-- map), a second request to the same party, a full party, and an 11th open request
-- (D2; requests to parties past their cutoff no longer count).
--
-- Verified 2026-10-05: SECURITY DEFINER, search_path empty; anon cannot execute it,
-- authenticated can.

CREATE FUNCTION public.request_to_join(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $f$
declare
  v_uid uuid := (select auth.uid());
  v_is_public boolean;
  v_host_id uuid;
  v_event_date timestamptz;
  v_ends_at timestamptz;
begin
  select e.is_public, e.host_id, e.event_date, e.ends_at
    into v_is_public, v_host_id, v_event_date, v_ends_at
  from public.events e
  where e.id = p_event_id;

  if not found then
    raise exception 'Diese Party gibt es nicht mehr.' using errcode = 'P0002';
  end if;

  -- The capacity trigger's lock on the party, then one per person, so two requests
  -- in parallel can neither overfill a party nor slip past the limit of 10.
  perform pg_advisory_xact_lock(hashtext(p_event_id::text));
  perform pg_advisory_xact_lock(hashtext('join_requests:' || v_uid::text));

  if v_is_public then
    raise exception 'Diese Party ist öffentlich. Du kannst direkt zusagen.' using errcode = 'P0001';
  end if;

  if v_host_id = v_uid then
    raise exception 'Das ist deine eigene Party.' using errcode = 'P0001';
  end if;

  if private.has_party_access(p_event_id) then
    raise exception 'Du hast schon Zugang zu dieser Party.' using errcode = 'P0001';
  end if;

  if now() >= private.party_visible_until(v_event_date, v_ends_at) then
    raise exception 'Diese Party ist schon vorbei.' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.join_requests jr where jr.event_id = p_event_id and jr.user_id = v_uid) then
    raise exception 'Du hast diese Party schon angefragt.' using errcode = '23505';
  end if;

  if not public.party_has_room(p_event_id, v_uid) then
    raise exception 'Diese Party ist voll.' using errcode = 'check_violation';
  end if;

  -- Only requests to parties still before their cutoff count; older ones fall away
  -- with the 24-hour rule, without a cleanup job.
  if (
    select count(*)
    from public.join_requests jr
    join public.events e on e.id = jr.event_id
    where jr.user_id = v_uid
      and private.party_visible_until(e.event_date, e.ends_at) > now()
  ) >= 10 then
    raise exception 'Du hast schon 10 offene Anfragen. Warte, bis ein Host antwortet.' using errcode = 'P0001';
  end if;

  insert into public.join_requests (event_id, user_id) values (p_event_id, v_uid);
end;
$f$;

REVOKE ALL ON FUNCTION public.request_to_join(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_to_join(uuid) TO authenticated;
