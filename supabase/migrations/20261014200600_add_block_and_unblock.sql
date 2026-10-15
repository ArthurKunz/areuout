-- Blockieren, Teil 2: block_user und unblock_user (Schritt 13b).
--
-- block_user legt die Blockierung an und raeumt im selben Zug zwischen den beiden auf:
--   1. offene Beitrittsanfragen, in beide Richtungen;
--   2. Zusagen und invite_opens des Blockierten auf den Partys des Blockierenden, die
--      noch vor private.party_visible_until liegen (entschieden 2026-10-14: der
--      Blockierte wird entfernt, wie wenn der Host ihn entfernt). Die Trigger
--      rsvps_drop_pool_responses und rsvps_drop_invite_open nehmen seine Stimmen,
--      Antworten und seine invite_opens-Zeile mit;
--   3. spiegelbildlich die Zusagen und invite_opens des Blockierenden auf den kommenden
--      Partys des Blockierten. Sonst hielte er einen Platz auf einer Party, die er nicht mehr sieht
--      und deren Zusage er nicht mehr aendern kann (can_rsvp_to_event lehnt ab).
-- Die beiden Personen-Sperren sind dieselben, die request_to_join nimmt
-- ('join_requests:' || uid), in fester Reihenfolge gegen Deadlocks. Eine Anfrage, die
-- gleichzeitig laeuft, landet also vor dem Aufraeumen oder sieht die Blockierung.
--
-- unblock_user loescht nur die eigene Zeile. Es stellt nichts wieder her.
--
-- Wird von Arthur im SQL-Editor ausgefuehrt, weil das MCP-Werkzeug Anweisungen mit
-- DELETE ablehnt; danach die Version per INSERT in supabase_migrations.schema_migrations
-- eintragen (supabase/migrations/README.md). Setzt 20261014200517_create_blocks.sql voraus.

begin;

create function public.block_user(p_user_id uuid)
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

create function public.unblock_user(p_user_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  delete from public.blocks b
  where b.blocker_id = (select auth.uid())
    and b.blocked_id = p_user_id;
end;
$function$;

revoke all on function public.block_user(uuid) from public, anon;
revoke all on function public.unblock_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated, service_role;
grant execute on function public.unblock_user(uuid) to authenticated, service_role;

commit;
