-- events.background_url nimmt nur noch ein Preset oder eine Datei aus unserem Bucket
-- (Final Review von Schritt 12, Befund A4).
--
-- Bisher stand jede beliebige URL drin. Ein Host konnte per update_party oder direktem
-- PATCH eine fremde Adresse setzen, und jeder, der die Party in Explore, im Detail, auf
-- der Einladungsseite oder in der Chat-Vorschau sieht, laedt das Bild von dort: ein
-- Tracking-Pixel, das IP und Browser an einen fremden Server gibt. Die Datenschutzerklaerung
-- sagt: Hintergrund ist ein vorgegebenes Motiv oder ein eigenes Foto im Speicher von
-- Supabase.
--
-- Erlaubt: null, die Presets /backgrounds/bg-N.jpg aus /public und Dateien im Bucket
-- event-backgrounds DIESES Projekts. Die Projekt-Ref steht bewusst fest drin: ein
-- generisches *.supabase.co wuerde ein fremdes Supabase-Projekt als Tracking-Server
-- durchlassen. Wird das Projekt je neu aufgesetzt, muss dieser CHECK mit.
--
-- NOT VALID, dann VALIDATE: am 12.10.2026 enthielt die einzige Zeile ein Preset.

alter table public.events add constraint events_background_url_check check (
  background_url is null
  or background_url ~ '^/backgrounds/bg-[0-9]+\.jpg$'
  or background_url ~ '^https://desolyjfpbxlydbdqixp\.supabase\.co/storage/v1/object/public/event-backgrounds/'
) not valid;

alter table public.events validate constraint events_background_url_check;
