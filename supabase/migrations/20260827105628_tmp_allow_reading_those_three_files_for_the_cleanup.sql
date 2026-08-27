-- BEFRISTET, gehört zu tmp_cleanup_orphaned_files und fällt mit ihr zusammen weg.
--
-- Der Storage-Dienst schlägt ein Objekt vor dem Löschen nach. Ohne SELECT scheitert
-- deshalb schon dieser Schritt mit AccessDenied, obwohl die DELETE-Policy passt. anon
-- hat seit dem 23.08.2026 bewusst kein SELECT auf storage.objects — also hier für
-- dieselben drei ausdrücklich benannten Dateien, und nur für sie.
create policy "tmp_cleanup_read_orphaned_files"
  on storage.objects for select
  to anon
  using (
    (bucket_id = 'avatars' and name = '66b4d834-bff5-43f3-a5db-db7043f7f364/avatar-1786473484668.jpeg')
    or (bucket_id = 'avatars' and name = 'a39f6d7b-f5ab-4715-bd37-13a8188c816f/avatar-1787486368591.jpg')
    or (bucket_id = 'event-backgrounds' and name = '66b4d834-bff5-43f3-a5db-db7043f7f364/ee963b96-20e4-4aad-b094-c25c40e1c467/background.jpeg')
  );
