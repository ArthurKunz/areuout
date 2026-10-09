-- fix_invite_opens_found_flag_bug
--
-- Fixes the bug in record_who_opened_an_invite_link (previous file), caught before
-- that version was ever verified or exposed to a real user: FOUND was read again
-- after the miss-tracking block's own INSERT/DELETE had already overwritten it, so a
-- wrong invite code from an authenticated caller could attempt
-- `insert into private.invite_opens (event_id, ...)` with event_id still NULL and
-- raise a NOT NULL violation instead of simply returning no rows.
--
-- Fix: snapshot FOUND into v_matched immediately after RETURN QUERY, before any other
-- statement can touch it, and branch on that snapshot everywhere below.
--
-- Rollback:
--   Restore the function body from the previous migration file
--   (record_who_opened_an_invite_link, the pre-fix version), or from
--   ~/db-backups/definitions-2026-10-02.sql for the version before invite_opens
--   existed at all.
--
-- Verified 2026-10-02 in rolled-back transactions: result columns byte-identical to
-- the pre-invite_opens signature; authenticated caller + wrong code -> 0 rows, no
-- exception, 0 invite_opens rows; anon + wrong code -> 0 rows, 0 invite_opens rows;
-- authenticated + right code, called twice -> exactly 1 invite_opens row after both
-- calls (no duplicate).

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
  v_matched boolean;
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

  -- Snapshot immediately: the miss-tracking INSERT/DELETE below would otherwise
  -- overwrite FOUND before the invite_opens check at the bottom reads it.
  v_matched := found;

  if v_matched then
    select e.id into v_event_id from events e where e.invite_code = p_invite_code;
  end if;

  if not v_matched and v_ip is not null then
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

  if v_matched and auth.uid() is not null then
    insert into private.invite_opens (event_id, user_id)
    values (v_event_id, auth.uid())
    on conflict (event_id, user_id) do nothing;
  end if;
end;
$function$;
