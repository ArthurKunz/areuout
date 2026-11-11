-- Party Agent, Schritt 2, Migration 4: drei Regeln (Vault: Party Agent Database Review).
--
-- 1. Abgesagte Agent-Events nehmen keine Zusagen mehr an, weder neue noch eine Änderung
--    auf 'going' / 'maybe'. Ein Austragen bleibt möglich (DELETE ist nicht betroffen).
--    Die Policies dürfen private nicht lesen (kein USAGE, SCHEMA.md 8), daher eine
--    SECURITY-DEFINER-Funktion in public, wie can_rsvp_to_event.
-- 2. Den areuout-Systemaccount kann niemand blockieren (D5): sonst verschwänden alle
--    Agent-Events ohne Erklärung.
-- 3. Melde-Grund 'organizer' ("Ich bin der Veranstalter").

create or replace function public.rsvp_is_open(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.agent_event_details d
    where d.event_id = p_event_id and d.cancelled_at is not null
  );
$$;

revoke execute on function public.rsvp_is_open(uuid) from public, anon;
grant execute on function public.rsvp_is_open(uuid) to authenticated;

alter policy rsvps_insert_authenticated on public.rsvps
  with check (
    (user_id = (select auth.uid()))
    and (not (exists (select 1 from public.events e where e.id = rsvps.event_id and e.host_id = (select auth.uid()))))
    and ((status <> 'going'::text) or public.party_has_room(event_id, (select auth.uid())))
    and public.can_rsvp_to_event(event_id)
    and public.rsvp_is_open(event_id)
  );

alter policy rsvps_update_own on public.rsvps
  with check (
    (user_id = auth.uid())
    and (not (exists (select 1 from public.events e where e.id = rsvps.event_id and e.host_id = auth.uid())))
    and ((status <> 'going'::text) or public.party_has_room(event_id, auth.uid()))
    and (status = 'not_going'::text or public.rsvp_is_open(event_id))
  );

create or replace function public.block_user(p_user_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if p_user_id = v_uid then
    raise exception 'Du kannst dich nicht selbst blockieren.' using errcode = '22023';
  end if;

  if p_user_id = private.agent_system_account() then
    raise exception 'areuout kannst du nicht blockieren.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'Diese Person gibt es nicht mehr.' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtext('join_requests:' || least(v_uid, p_user_id)::text));
  perform pg_advisory_xact_lock(hashtext('join_requests:' || greatest(v_uid, p_user_id)::text));

  insert into public.blocks (blocker_id, blocked_id)
  values (v_uid, p_user_id)
  on conflict (blocker_id, blocked_id) do nothing;

  delete from public.join_requests jr
  using public.events e
  where e.id = jr.event_id
    and ((jr.user_id = p_user_id and e.host_id = v_uid)
      or (jr.user_id = v_uid and e.host_id = p_user_id));

  delete from public.rsvps r
  using public.events e
  where e.id = r.event_id
    and ((r.user_id = p_user_id and e.host_id = v_uid)
      or (r.user_id = v_uid and e.host_id = p_user_id))
    and private.party_visible_until(e.event_date, e.ends_at) > now();

  delete from private.invite_opens io
  using public.events e
  where e.id = io.event_id
    and ((io.user_id = p_user_id and e.host_id = v_uid)
      or (io.user_id = v_uid and e.host_id = p_user_id))
    and private.party_visible_until(e.event_date, e.ends_at) > now();
end;
$function$;

alter table public.reports drop constraint reports_reason_check;
alter table public.reports add constraint reports_reason_check
  check (reason = any (array['spam'::text, 'harassment'::text, 'inappropriate'::text, 'other'::text, 'organizer'::text]));
