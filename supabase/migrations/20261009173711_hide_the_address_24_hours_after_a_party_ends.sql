-- Die 24-Stunden-Regel auch fuer die Adresse (Schritt 12 des Redesigns).
--
-- get_party_detail gab Adresse und exakten Punkt an jeden mit Zugang heraus, ohne
-- jedes Zeitlimit: eine Party vom letzten Jahr antwortete noch mit ihrer Anschrift.
-- Ab private.party_visible_until (24 Stunden nach dem Ende, ohne Ende nach dem
-- Beginn) bekommt jeder ausser dem Host jetzt dasselbe wie ein Fremder: location NULL,
-- den verwischten Punkt und is_exact false. Dieselbe Grenze, an der die Party von jeder
-- Karte und Liste verschwindet und Anfragen schliessen, mit demselben Vergleich
-- (`> now()`) wie get_explore_parties, get_my_parties und get_hosting_parties.
--
-- Gleiche Rueckgabeform, deshalb CREATE OR REPLACE ohne DROP: Grants und Owner bleiben,
-- die Typen aendern sich nicht. main ruft die Funktion nicht auf; sie kann jederzeit
-- laufen.
--
-- Bricht ab, wenn der Rumpf auf der Datenbank nicht mehr der ist, gegen den diese Datei
-- geschrieben wurde (md5 vom 09.10.2026).

do $$
begin
  if (select md5(prosrc) from pg_proc
      where oid = 'public.get_party_detail(uuid)'::regprocedure) <> 'd7541dd6c01751420e9f59399af800f6' then
    raise exception 'get_party_detail changed since 2026-10-09, compare before applying';
  end if;
end;
$$;

CREATE OR REPLACE FUNCTION public.get_party_detail(p_event_id uuid)
 RETURNS TABLE(id uuid, host_id uuid, host_firstname text, host_lastname text, host_avatar_url text, host_avatar_color text, title text, description text, motto text, dresscode text, event_date timestamp with time zone, ends_at timestamp with time zone, background_url text, max_guests integer, price numeric, is_public boolean, lat double precision, lng double precision, is_exact boolean, location text, my_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT
    e.id, e.host_id, p.firstname, p.lastname,
    p.avatar_url, p.avatar_color,
    e.title, e.description, e.motto, e.dresscode, e.event_date, e.ends_at, e.background_url,
    e.max_guests, e.price, e.is_public,
    CASE WHEN x.exact THEN e.lat ELSE e.fuzzy_lat END,
    CASE WHEN x.exact THEN e.lng ELSE e.fuzzy_lng END,
    x.exact,
    CASE WHEN x.exact THEN e.location ELSE NULL END,
    COALESCE(r.status, CASE WHEN jr.user_id IS NOT NULL THEN 'requested' END)
  FROM public.events e
  JOIN public.profiles p ON p.id = e.host_id
  CROSS JOIN LATERAL (
    SELECT private.has_exact_access(e.id, e.is_public)
       AND (e.host_id = (SELECT auth.uid())
            OR private.party_visible_until(e.event_date, e.ends_at) > now()) AS exact
  ) x
  LEFT JOIN public.rsvps r ON r.event_id = e.id AND r.user_id = (SELECT auth.uid())
  LEFT JOIN public.join_requests jr ON jr.event_id = e.id AND jr.user_id = (SELECT auth.uid())
  WHERE e.id = p_event_id;
$function$
;
