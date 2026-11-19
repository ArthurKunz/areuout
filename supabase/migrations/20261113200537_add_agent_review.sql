-- Party Agent, Schritt 4: der Admin-Screen "Neue Events" und die Push an Arthur.
--
-- Vier Funktionen fuer die App, alle nur fuer authenticated und alle pruefen zuerst
-- private.is_admin() (die Allowlist aus Schritt 2). Wer nicht in private.admins steht,
-- bekommt 42501, egal was die App anzeigt oder versteckt:
--
-- - am_i_admin(): ja oder nein, fuer die Seite /admin und die Zeile im Profil.
-- - get_agent_drafts(): die offenen Entwuerfe (kind 'new'), frueheste zuerst. Vorher
--   werden Entwuerfe, deren Event schon begonnen hat, auf 'expired' gesetzt: so verlassen
--   sie den Screen ohne Zeitplan (pg_cron kommt erst in Schritt 7).
-- - approve_agent_candidate(id): kopiert einen Entwurf nach events (Host ist der
--   Systemaccount, oeffentlich, ohne Kapazitaet) und legt agent_event_details an. Erst
--   jetzt ist das Event irgendwo sichtbar.
-- - discard_agent_candidate(id): setzt den Entwurf auf 'discarded'. Er kommt nicht wieder,
--   weil der Agent alle bekannten Quellen in jedem Status kennt.
--
-- Dazu private.queue_admin_push(body): wie private.queue_push, aber an alle Admins, mit dem
-- festen Titel "Neue Events" und data {"path": "/admin"}, damit ein Tipp den Screen
-- oeffnet. Aufgerufen nur von der Edge Function party-agent (Rolle postgres), nie von der
-- App. Fehler werden zur Warnung, der Agent-Lauf scheitert nie an der Push. Kein Name einer
-- Person im Text (CLAUDE.md).
--
-- Rollback: supabase/rollbacks/20261113200537_add_agent_review.sql

create function public.am_i_admin()
 returns boolean
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select private.is_admin();
$function$;

create function public.get_agent_drafts()
 returns table (
  id uuid,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  event_type text,
  price numeric,
  organizer_name text,
  website_url text,
  source_url text,
  background_url text,
  description text,
  duplicate_title text
 )
 language plpgsql
 security definer
 set search_path to ''
as $function$
#variable_conflict use_column
begin
  if not private.is_admin() then
    raise exception 'Nur Admins dürfen das.' using errcode = '42501';
  end if;

  update private.agent_candidates c
  set status = 'expired', decided_at = now()
  where c.status = 'draft' and c.starts_at <= now();

  return query
  select c.id, c.title, c.starts_at, c.ends_at, c.location, c.event_type, c.price,
         c.organizer_name, c.website_url, c.source_url, c.background_url, c.description,
         e.title
  from private.agent_candidates c
  left join public.events e on e.id = c.duplicate_of
  where c.status = 'draft' and c.kind = 'new'
  order by c.starts_at, c.created_at;
end;
$function$;

create function public.approve_agent_candidate(p_id uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_candidate private.agent_candidates%rowtype;
  v_host uuid;
  v_event_id uuid := gen_random_uuid();
  v_invite_code text;
begin
  if not private.is_admin() then
    raise exception 'Nur Admins dürfen das.' using errcode = '42501';
  end if;

  select * into v_candidate
  from private.agent_candidates c
  where c.id = p_id and c.kind = 'new' and c.status = 'draft'
  for update;
  if not found then
    raise exception 'Diesen Entwurf gibt es nicht mehr.' using errcode = 'P0002';
  end if;
  if v_candidate.starts_at <= now() then
    raise exception 'Dieses Event hat schon angefangen.' using errcode = '22023';
  end if;

  v_host := private.agent_system_account();
  if v_host is null then
    raise exception 'Systemaccount fehlt in private.agent_config.' using errcode = 'P0002';
  end if;

  -- Wie generateInviteCode in lib/utils.ts: 12 Zeichen aus demselben Alphabet.
  select string_agg(substr('0123456789abcdefghjkmnpqrstvwxyz', get_byte(b.bytes, i) % 32 + 1, 1), '' order by i)
    into v_invite_code
  from (select extensions.gen_random_bytes(12) as bytes) b, generate_series(0, 11) i;

  insert into public.events (
    id, host_id, title, is_public, event_date, ends_at, location, lat, lng,
    background_url, invite_code, description, max_guests, price, website_url
  ) values (
    v_event_id, v_host, v_candidate.title, true, v_candidate.starts_at, v_candidate.ends_at,
    v_candidate.location, v_candidate.lat, v_candidate.lng, v_candidate.background_url,
    v_invite_code, v_candidate.description, null, v_candidate.price, v_candidate.website_url
  );

  insert into public.agent_event_details (event_id, source_url, starts_on, organizer_name, last_checked_at)
  values (v_event_id, v_candidate.source_url, v_candidate.starts_on, v_candidate.organizer_name, now());

  update private.agent_candidates
  set status = 'approved', event_id = v_event_id, decided_at = now()
  where id = p_id;

  return v_event_id;
end;
$function$;

create function public.discard_agent_candidate(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if not private.is_admin() then
    raise exception 'Nur Admins dürfen das.' using errcode = '42501';
  end if;

  update private.agent_candidates c
  set status = 'discarded', decided_at = now()
  where c.id = p_id and c.status = 'draft';
  if not found then
    raise exception 'Diesen Entwurf gibt es nicht mehr.' using errcode = 'P0002';
  end if;
end;
$function$;

revoke all on function public.am_i_admin() from public, anon;
revoke all on function public.get_agent_drafts() from public, anon;
revoke all on function public.approve_agent_candidate(uuid) from public, anon;
revoke all on function public.discard_agent_candidate(uuid) from public, anon;
grant execute on function public.am_i_admin() to authenticated;
grant execute on function public.get_agent_drafts() to authenticated;
grant execute on function public.approve_agent_candidate(uuid) to authenticated;
grant execute on function public.discard_agent_candidate(uuid) to authenticated;

create function private.queue_admin_push(p_body text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_tokens text[];
  v_secret text;
begin
  begin
    select array_agg(pt.token) into v_tokens
    from public.push_tokens pt
    join private.admins a on a.user_id = pt.user_id;
    if v_tokens is null then
      return;
    end if;

    select s.decrypted_secret into v_secret
    from vault.decrypted_secrets s
    where s.name = 'push_secret';
    if v_secret is null then
      raise warning 'admin push not queued: no secret';
      return;
    end if;

    perform net.http_post(
      url := 'https://desolyjfpbxlydbdqixp.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-secret', v_secret),
      body := jsonb_build_object(
        'tokens', to_jsonb(v_tokens),
        'title', 'Neue Events',
        -- send-push nimmt hoechstens 200 Zeichen.
        'body', left(p_body, 200),
        'data', jsonb_build_object('path', '/admin')),
      timeout_milliseconds := 20000);
  exception when others then
    raise warning 'admin push not queued: %', sqlerrm;
  end;
end;
$function$;

revoke all on function private.queue_admin_push(text) from public, anon, authenticated;
