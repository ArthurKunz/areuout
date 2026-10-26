-- Rollback zu supabase/migrations/20261026110000_push_accepted_join_requests.sql.
-- Stellt accept_join_request Zeichen fuer Zeichen so wieder her, wie es vor dem Push stand
-- (ohne den Aufruf von private.queue_push). Owner, SECURITY DEFINER, search_path und Rechte
-- bleiben bei CREATE OR REPLACE unveraendert. Enthaelt DELETE: im SQL-Editor ausfuehren.

begin;

create or replace function public.accept_join_request(p_event_id uuid, p_user_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
$function$;

commit;
