-- BEFRISTET. Wird in 20260827105649 wieder entfernt.
--
-- Drei Dateien sind verwaist: ihre Konten wurden am 27.08.2026 über das Supabase-
-- Dashboard gelöscht, das den Speicher nicht anfasst. Damit greift keine der
-- bestehenden DELETE-Policies mehr — sie prüfen auth.uid() gegen den Ordnernamen, und
-- diese Nutzer gibt es nicht mehr. Ein SQL-delete verbietet storage.protect_delete()
-- zu Recht: es würde nur die Zeile entfernen und die Datei selbst zurücklassen.
--
-- Deshalb dieser Weg: die drei Namen ausdrücklich aufgezählt, kein Muster, keine
-- Ordner-Logik. Was nicht wortwörtlich in dieser Liste steht, ist nicht betroffen.
create policy "tmp_cleanup_orphaned_files"
  on storage.objects for delete
  to anon
  using (
    (bucket_id = 'avatars' and name = '66b4d834-bff5-43f3-a5db-db7043f7f364/avatar-1786473484668.jpeg')
    or (bucket_id = 'avatars' and name = 'a39f6d7b-f5ab-4715-bd37-13a8188c816f/avatar-1787486368591.jpg')
    or (bucket_id = 'event-backgrounds' and name = '66b4d834-bff5-43f3-a5db-db7043f7f364/ee963b96-20e4-4aad-b094-c25c40e1c467/background.jpeg')
  );
