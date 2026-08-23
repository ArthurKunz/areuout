-- Beide Buckets liessen sich von JEDEM auflisten. Mit dem anon-Key, der per Definition
-- im Browser-Bundle liegt:
--
--   POST /storage/v1/object/list/avatars  ->  jede Nutzer-ID
--   POST /storage/v1/object/list/avatars {"prefix":"<id>"}  ->  jeder Dateiname
--
-- Damit war die "unerratbare URL" keine Schutzmassnahme, sondern eine Annahme: wer
-- auflisten kann, baut sich jede oeffentliche URL selbst zusammen und laedt saemtliche
-- Profilfotos der App herunter.
--
-- Ursache waren zwei SELECT-Policies fuer die Rolle 'public', die 'anon' einschliesst.
-- Sie steuern nicht den /object/public/-Endpunkt (der umgeht RLS und liefert weiter
-- aus), sondern den Zugriff auf die Metadaten-Tabelle - und damit das Auflisten und
-- das Ausstellen von Signed URLs.
--
-- Geprueft nach der Umstellung: Auflisten durch anon liefert [], eine Signed URL durch
-- anon scheitert mit 404, der Bild-Abruf ueber die oeffentliche URL liefert weiter 200.

drop policy if exists "Anyone can view avatars" on storage.objects;
drop policy if exists "avatars_select_authenticated" on storage.objects;

create policy "avatars_select_authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars');

drop policy if exists "Anyone can view event backgrounds" on storage.objects;
drop policy if exists "event_backgrounds_select_authenticated" on storage.objects;

create policy "event_backgrounds_select_authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'event-backgrounds');

-- Zwei identische INSERT-Policies auf avatars, eine davon ist ueberfluessig.
drop policy if exists "Users can upload their own avatar" on storage.objects;
