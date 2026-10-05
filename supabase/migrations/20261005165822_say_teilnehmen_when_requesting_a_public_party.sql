-- say_teilnehmen_when_requesting_a_public_party
--
-- Rollback: re-apply 20261005164336_add_request_to_join_function.sql as CREATE OR REPLACE.
--
-- Arthur's wording for the refusal on a public party: `teilnehmen`, the word on the
-- public party's button (App Redesign 3.5), instead of `zusagen`. Nothing else changes.
--
-- Verified 2026-10-05: the function carries the new text and not the old one; still
-- SECURITY DEFINER with an empty search_path, authenticated only.

CREATE OR REPLACE FUNCTION public.request_to_join(p_event_id uuid)
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
    raise exception 'Diese Party ist öffentlich. Du kannst direkt teilnehmen.' using errcode = 'P0001';
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

