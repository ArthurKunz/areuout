-- record_who_opened_an_invite_link
--
-- Superseded four minutes later by fix_invite_opens_found_flag_bug (20261002203916):
-- this version has a bug, caught before it was ever verified or exposed to a real
-- user. FOUND gets silently overwritten by the miss-tracking block's own INSERT below,
-- so an authenticated caller typing a WRONG invite code could hit a NOT NULL violation
-- on invite_opens.event_id (v_event_id was never assigned) instead of a clean "not
-- found". Kept as its own file, not rewritten, because this is exactly what was
-- actually applied to the live database at this version — the fix is the next file.
--
-- Rollback:
--   Restore get_party_by_invite_code from ~/db-backups/definitions-2026-10-02.sql
--   DROP TABLE IF EXISTS private.invite_opens;

CREATE TABLE private.invite_opens (
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opened_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE OR REPLACE FUNCTION public.get_party_by_invite_code(p_invite_code text)
 RETURNS TABLE(id uuid, host_id uuid, title text, description text, motto text, dresscode text, event_date timestamp with time zone, ends_at timestamp with time zone, location text, invite_code text, background_url text, max_guests integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c_limit constant integer := 30;
  c_assumed_hours constant interval := interval '6 hours';
  v_ip text;
  v_misses integer;
  v_event_id uuid;
begin
  v_ip := coalesce(
    nullif(current_setting('request.headers', true)::json ->> 'cf-connecting-ip', ''),
    nullif(split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1), '')
  );

  if v_ip is not null then
    select m.misses into v_misses
    from private.invite_lookup_misses m
    where m.client_ip = v_ip
      and m.window_start = date_trunc('minute', now());

    if coalesce(v_misses, 0) >= c_limit then
      raise sqlstate 'PT429' using message = 'Zu viele Versuche. Warte einen Moment.';
    end if;
  end if;

  return query
    select e.id, e.host_id, e.title, e.description, e.motto, e.dresscode, e.event_date,
           e.ends_at,
           case
             when coalesce(e.ends_at, e.event_date + c_assumed_hours) < now()
                  and auth.uid() is distinct from e.host_id
             then ''
             else e.location
           end,
           e.invite_code, e.background_url, e.max_guests
    from events e
    where e.invite_code = p_invite_code;

  if not found and v_ip is not null then
    insert into private.invite_lookup_misses as m (client_ip, window_start, misses)
    values (v_ip, date_trunc('minute', now()), 1)
    on conflict (client_ip) do update
      set misses = case
                     when m.window_start = date_trunc('minute', now()) then m.misses + 1
                     else 1
                   end,
          window_start = date_trunc('minute', now());

    if random() < 0.01 then
      delete from private.invite_lookup_misses
      where window_start < now() - interval '1 hour';
    end if;
  end if;

  -- Records that this signed-in user has now seen this party's invite link, which
  -- grants them RSVP access even on a private party (see rsvps_insert_authenticated).
  -- BUG: `found` here no longer reflects the RETURN QUERY above once the miss-tracking
  -- block just ran its own INSERT/DELETE — fixed in the next migration.
  if found and auth.uid() is not null then
    select e.id into v_event_id from events e where e.invite_code = p_invite_code;
    insert into private.invite_opens (event_id, user_id)
    values (v_event_id, auth.uid())
    on conflict (event_id, user_id) do nothing;
  end if;
end;
$function$;
