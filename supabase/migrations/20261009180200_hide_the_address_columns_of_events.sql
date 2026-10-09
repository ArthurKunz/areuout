-- Adresse und exakter Punkt nur noch ueber die Funktionen (Schritt 12 des Redesigns).
--
-- events_select_member gibt Host und jedem Gast die ganze events-Zeile, fuer immer. Wer
-- direkt `select location, lat, lng from events` schrieb, ging an jeder Regel der
-- Funktionen vorbei, auch an der 24-Stunden-Regel aus
-- 20261009180000_hide_the_address_24_hours_after_a_party_ends.sql. Die Policy laesst
-- sich nicht einfach auf den Host einengen: die Policies von pool_responses schauen als
-- Gast in events, und Abstimmen braucht diese Sicht.
--
-- Deshalb Spaltenrechte statt Zeilenrechte: SELECT auf die Tabelle weg, SELECT auf jede
-- Spalte ausser location, lat und lng zurueck. Die neue App liest aus events direkt nur
-- invite_code (PartyDetail, als Host). Adresse und Punkt kommen aus get_party_detail und
-- den Kartenfunktionen; die sind SECURITY DEFINER und von Spaltenrechten unberuehrt.
-- Ebenso die Trigger auf events. create_party und update_party (SECURITY INVOKER)
-- schreiben location, lat und lng, lesen sie aber nicht: UPDATE braucht SELECT nur auf
-- den Spalten in WHERE und RETURNING, hier id und host_id. Getestet am 09.10.2026 in
-- einer zurueckgerollten Transaktion: Anlegen, Bearbeiten, Link zuruecksetzen und
-- Loeschen als Host, Abstimmen als Gast.
--
-- anon bekommt nichts zurueck. anon hat keine Policy auf events und las dort nie eine
-- Zeile; der Grant war nur die Supabase-Vorgabe (SCHEMA.md, Abschnitt 2).
--
-- FALLE fuer spaeter: Eine neue Spalte auf events ist fuer authenticated NICHT lesbar,
-- bis sie hier unten mit einem eigenen GRANT nachgetragen wird.
--
-- Erst NACH dem Merge in main anwenden, wenn das Vercel-Deployment auf Ready steht:
-- die alte App liest location direkt aus der Tabelle.

revoke select on public.events from anon, authenticated;

grant select (
  id, host_id, title, description, invite_code, event_date, max_guests, created_at,
  background_url, ends_at, motto, dresscode, is_public, fuzzy_lat, fuzzy_lng, price
) on public.events to authenticated;
