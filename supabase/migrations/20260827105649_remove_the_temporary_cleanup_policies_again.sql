-- Die beiden Policies aus 20260827105603 und 20260827105628, mit denen die drei
-- verwaisten Dateien vom 27.08.2026 über die Storage-API entfernt wurden. Die Dateien
-- sind weg, das Recht gehört es damit auch. anon hat auf storage.objects wieder gar
-- nichts — nachgeprüft über pg_policy: acht Policies, alle auf den eigenen Ordner
-- eines angemeldeten Kontos, keine einzige für anon.
drop policy if exists "tmp_cleanup_orphaned_files" on storage.objects;
drop policy if exists "tmp_cleanup_read_orphaned_files" on storage.objects;
