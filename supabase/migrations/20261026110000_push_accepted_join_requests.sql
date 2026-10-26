-- Push, Teil 5c: wer angenommen wird, bekommt eine Mitteilung. accept_join_request bleibt
-- wie es war, mit einem neuen Block am Ende: private.queue_push an die angenommene Person,
-- Titel der Partytitel, Text "Du bist dabei – deine Anfrage wurde angenommen", data nur die
-- Party-ID; kein Name des Hosts (CLAUDE.md).
--
-- Der Block steht nach dem INSERT in rsvps: ist die Party voll, bricht
-- rsvps_enforce_capacity vorher ab, der ganze Aufruf rollt zurueck und nichts wird
-- eingereiht. Gesendet wird erst nach dem COMMIT. queue_push faengt jeden eigenen Fehler ab,
-- der Block hier zusaetzlich einen fehlenden oder kaputten queue_push (wie im Trigger
-- join_requests_push_new): das Annehmen gelingt also immer, auch wenn Push scheitert.
--
-- CREATE OR REPLACE laesst Owner, SECURITY DEFINER, search_path und Rechte unveraendert.
-- Der Rumpf enthaelt DELETE: im SQL-Editor ausgefuehrt, Version von Hand eingetragen.

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

  begin
    perform private.queue_push(p_user_id, v_host_id, p_event_id, 'Du bist dabei – deine Anfrage wurde angenommen');
  exception when others then
    raise warning 'push trigger failed for %: %', p_event_id, sqlerrm;
  end;
end;
$function$;

commit;
