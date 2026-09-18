-- Ein optionales Motto pro Party. Nullable, weil es das von Anfang an ist: keine
-- bestehende Zeile bekommt einen Wert, und eine Party darf ohne Motto existieren und
-- fuer immer ohne bleiben.
--
-- Keine Policy und kein Grant kommen hinzu. motto liegt in derselben events-Zeile wie
-- title und description; wer die Zeile lesen und schreiben darf, ist damit schon
-- entschieden.
alter table public.events add column motto text;

-- events_text_length_check ist EINE kombinierte Constraint ueber mehrere Spalten, also
-- wird sie gedroppt und vollstaendig neu gesetzt — dasselbe Muster wie in
-- 20260820230226_bound_what_the_columns_may_hold.sql, aus dem die drei anderen Zeilen
-- unveraendert stammen.
--
-- 200 statt der 20 aus der Oberflaeche, aus dem Grund, den jene Migration schon fuer
-- title notiert hat: der CHECK soll das Megabyte abfangen, das per anon-Key direkt an
-- PostgREST geschickt wird, nicht das Formular ein zweites Mal durchsetzen. Eine
-- Constraint, die enger sitzt als die UI, macht aus der naechsten Copy-Entscheidung
-- einen fehlgeschlagenen Speichervorgang.
alter table public.events drop constraint if exists events_text_length_check;
alter table public.events add constraint events_text_length_check
  check (
    length(title) <= 200
    and length(location) <= 500
    and length(description) <= 5000
    and length(motto) <= 200
  );
