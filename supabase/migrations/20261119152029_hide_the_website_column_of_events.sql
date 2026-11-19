-- Party Agent, Schritt 9 (Code-Review): events.website_url nur noch ueber get_party_detail.
--
-- Die Spalte hatte seit Schritt 2 ein eigenes GRANT SELECT. Ueber RLS (events_select_member)
-- konnten Host und Gaeste sie damit direkt lesen, an get_party_detail vorbei, also auch nach
-- dem Ende plus 24 Stunden und ohne die Block-Pruefung. Website Link Abschnitt 13: der Link
-- folgt derselben Regel wie die Adresse, und location hat kein Spaltenrecht. Die App liest den
-- Link nur ueber get_party_detail (SECURITY DEFINER, braucht das Recht nicht) und schreibt ihn
-- nur ueber create_party und update_party. Die App-Store-App kennt die Spalte nicht.
--
-- Rollback: supabase/rollbacks/20261119152029_hide_the_website_column_of_events.sql

revoke select (website_url) on public.events from authenticated;
