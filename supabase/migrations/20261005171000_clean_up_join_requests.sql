-- clean_up_join_requests
--
-- Rollback:
--   DROP TRIGGER IF EXISTS rsvps_drop_join_request ON public.rsvps;
--   DROP TRIGGER IF EXISTS events_drop_join_requests_when_public ON public.events;
--   DROP FUNCTION IF EXISTS private.drop_join_request_on_rsvp();
--   DROP FUNCTION IF EXISTS private.drop_join_requests_when_public();
--
-- Two cases where a request has no reason to stay:
-- - Someone with a pending request opens the invite link and answers: their new RSVP
--   removes the request (the link is the invitation, App Redesign 4.2). The RSVP that
--   accept_join_request writes finds nothing left, since the function deleted it first.
-- - The host switches the party from private to public: every request to it goes,
--   public parties are joined directly.
-- Both run as SECURITY DEFINER in private: the person whose write fires them holds no
-- DELETE on other people's requests. No API role may call them.
--
-- Applied by Arthur in the SQL editor (the MCP tool declines statements with DELETE),
-- with the version recorded by hand in supabase_migrations.schema_migrations.

CREATE FUNCTION private.drop_join_request_on_rsvp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $f$
begin
  delete from public.join_requests jr where jr.event_id = new.event_id and jr.user_id = new.user_id;
  return null;
end;
$f$;

CREATE FUNCTION private.drop_join_requests_when_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $f$
begin
  if new.is_public and not old.is_public then
    delete from public.join_requests jr where jr.event_id = new.id;
  end if;
  return null;
end;
$f$;

REVOKE ALL ON FUNCTION private.drop_join_request_on_rsvp() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.drop_join_requests_when_public() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER rsvps_drop_join_request
AFTER INSERT ON public.rsvps
FOR EACH ROW EXECUTE FUNCTION private.drop_join_request_on_rsvp();

CREATE TRIGGER events_drop_join_requests_when_public
AFTER UPDATE OF is_public ON public.events
FOR EACH ROW EXECUTE FUNCTION private.drop_join_requests_when_public();
