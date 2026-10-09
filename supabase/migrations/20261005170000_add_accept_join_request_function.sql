-- add_accept_join_request_function
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.accept_join_request(uuid, uuid);
--
-- The host lets a requester in: in one transaction the request is deleted and an RSVP
-- `going` is written. Only the party's host may call it (42501 otherwise, checked
-- inside the function, not left to RLS). Takes the party's lock like the capacity
-- trigger and refuses after private.party_visible_until (D1). A full party is refused
-- by rsvps_enforce_capacity with 'Diese Party ist voll.'; the whole call rolls back
-- and the request stays pending. The new RSVP makes has_party_access true, which is
-- what releases the address and the exact point.
--
-- Applied by Arthur in the SQL editor (the MCP tool declines statements with DELETE),
-- with the version recorded by hand in supabase_migrations.schema_migrations.

CREATE FUNCTION public.accept_join_request(p_event_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $f$
declare
  v_host_id uuid;
  v_event_date timestamptz;
  v_ends_at timestamptz;
begin
  select e.host_id, e.event_date, e.ends_at
    into v_host_id, v_event_date, v_ends_at
  from public.events e
  where e.id = p_event_id;

  if not found then
    raise exception 'Diese Party gibt es nicht mehr.' using errcode = 'P0002';
  end if;

  if v_host_id is distinct from (select auth.uid()) then
    raise exception 'Nur der Host kann Anfragen annehmen.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_event_id::text));

  if now() >= private.party_visible_until(v_event_date, v_ends_at) then
    raise exception 'Diese Party ist schon vorbei.' using errcode = 'P0001';
  end if;

  delete from public.join_requests jr where jr.event_id = p_event_id and jr.user_id = p_user_id;
  if not found then
    raise exception 'Diese Anfrage gibt es nicht mehr.' using errcode = 'P0002';
  end if;

  -- rsvps_enforce_capacity refuses a full party with 'Diese Party ist voll.'; the
  -- whole call rolls back and the request stays.
  insert into public.rsvps (event_id, user_id, status) values (p_event_id, p_user_id, 'going');
end;
$f$;

REVOKE ALL ON FUNCTION public.accept_join_request(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_join_request(uuid, uuid) TO authenticated;
