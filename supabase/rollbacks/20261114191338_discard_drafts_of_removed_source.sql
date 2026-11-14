-- Rollback zu supabase/migrations/20261114191338_discard_drafts_of_removed_source.sql:
-- remove_agent_event wie in 20261114184640 (ohne das Verwerfen offener Entwuerfe).

begin;

create or replace function public.remove_agent_event(p_event_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_source text;
begin
  if not private.is_admin() then
    raise exception 'Nur Admins dürfen das.' using errcode = '42501';
  end if;

  select d.source_url into v_source
  from public.agent_event_details d
  join public.events e on e.id = d.event_id
  where d.event_id = p_event_id and e.host_id = private.agent_system_account()
  for update of e;
  if not found then
    raise exception 'Dieses Event gibt es nicht mehr.' using errcode = 'P0002';
  end if;

  insert into private.agent_blocked_sources (source_url, reason)
  values (v_source, 'organizer_request')
  on conflict (source_url) do nothing;

  -- Details, RSVPs, Meldungen und der freigegebene Entwurf gehen per Cascade mit.
  delete from public.events e where e.id = p_event_id;
end;
$function$;

commit;
