-- create_join_requests
--
-- Rollback:
--   DROP TABLE IF EXISTS public.join_requests;
--
-- Step 8 of the redesign (Join Request): a signed-in stranger asks the host of a private
-- party to let them in. The request lives here, outside rsvps and invite_opens, so
-- has_party_access, has_exact_access and is_party_member stay false while it is pending:
-- no address, no exact point, no polls until the host accepts.
--
-- Read: the requester their own row, the host every row of their party. Written only by
-- request_to_join (insert) and accept_join_request (delete); authenticated holds no
-- INSERT or UPDATE. Decline is the host's DELETE. The requester cannot withdraw: no
-- DELETE policy for them. anon gets nothing (SCHEMA.md section 2). Not in realtime.
--
-- Verified 2026-10-05: RLS on, exactly the three policies below, all to authenticated;
-- anon holds no privilege, authenticated SELECT and DELETE only; not in
-- supabase_realtime.

CREATE TABLE public.join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT join_requests_event_user_key UNIQUE (event_id, user_id)
);

CREATE INDEX join_requests_user_id_idx ON public.join_requests (user_id);

ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY join_requests_select_own ON public.join_requests
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY join_requests_select_host ON public.join_requests
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.host_id = (SELECT auth.uid())));

CREATE POLICY join_requests_delete_host ON public.join_requests
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.host_id = (SELECT auth.uid())));

REVOKE ALL ON public.join_requests FROM anon;
REVOKE INSERT, UPDATE ON public.join_requests FROM authenticated;
