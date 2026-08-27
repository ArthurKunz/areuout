-- Fund A aus RECHTLICHES-BESTANDSAUFNAHME.md, Nachtrag vom 26.08.2026.
--
-- Die beiden SELECT-Policies lauteten schlicht `bucket_id = '...'` für die Rolle
-- authenticated — ohne Ordner-Einschränkung. Jedes angemeldete Konto konnte damit die
-- Buckets auflisten und jede fremde Datei über die Storage-API herunterladen. Die
-- Migration vom 23.08. hat anon ausgesperrt, angemeldete Fremde aber nicht. Gemessen
-- vor dieser Änderung: mit dem eigenen Konto waren 2 fremde Dateien sichtbar.
--
-- INSERT, UPDATE und DELETE sind seit dem 09.08. auf den eigenen Ordner beschränkt;
-- nur SELECT stand offen. Die neue Regel ist dieselbe wie dort:
-- (storage.foldername(name))[1] = auth.uid()::text.
--
-- Was das NICHT kaputt macht, und warum:
--   * Anzeige. Beide Buckets sind public=true. Ein <img src> lädt über die öffentliche
--     URL und fragt keine Policy. Gästelisten, Avatare und Partyhintergründe bleiben
--     für alle sichtbar, die sie heute sehen. Nachgemessen: beide URLs antworten nach
--     der Änderung weiterhin mit HTTP 200 und image/jpeg.
--   * Aufräumen. Die einzige Stelle, die auflistet, ist removeStorageFolder in
--     lib/storage.ts, aufgerufen mit dem eigenen user.id (AccountScreen) oder mit
--     `${hostId}/${partyId}` beim Löschen der eigenen Party — beides der eigene Ordner.
--
-- Was es NICHT löst: die Buckets bleiben öffentlich, wer eine Datei-URL kennt, kommt an
-- das Bild. Genau so steht es in der Datenschutzerklärung, Abschnitt 6, und in § 11 der
-- Nutzungsbedingungen. Diese Migration schliesst das Auflisten, nicht die URL.
drop policy if exists "avatars_select_authenticated" on storage.objects;
create policy "avatars_select_own_folder"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "event_backgrounds_select_authenticated" on storage.objects;
create policy "event_backgrounds_select_own_folder"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'event-backgrounds' and (storage.foldername(name))[1] = (select auth.uid())::text);
