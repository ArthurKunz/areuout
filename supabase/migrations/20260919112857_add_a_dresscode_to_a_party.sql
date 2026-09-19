-- Ein optionaler Dresscode pro Party. Nullable aus demselben Grund wie motto: keine
-- bestehende Zeile bekommt einen Wert, und eine Party darf ohne Dresscode existieren
-- und fuer immer ohne bleiben.
--
-- Ein eigenes Feld NEBEN motto, nicht darin: das Thema der Party und die Frage, wie man
-- sich anzieht, sind zwei Angaben, die der Gastgeber einzeln setzen und einzeln wieder
-- leeren darf.
--
-- Keine Policy und kein Grant kommen hinzu. dresscode liegt in derselben events-Zeile
-- wie title und motto; wer die Zeile lesen und schreiben darf, ist damit schon
-- entschieden.
alter table public.events add column dresscode text;

-- events_text_length_check ist EINE kombinierte Constraint ueber mehrere Spalten, also
-- wird sie gedroppt und vollstaendig neu gesetzt — dasselbe Muster wie in
-- 20260918214647_add_a_motto_to_a_party.sql, aus dem die vier anderen Zeilen
-- unveraendert stammen.
--
-- 200 statt der 20 aus der Oberflaeche, aus demselben Grund, den jene Migration schon
-- fuer title und motto notiert hat: der CHECK soll das Megabyte abfangen, das per
-- anon-Key direkt an PostgREST geschickt wird, nicht das Formular ein zweites Mal
-- durchsetzen. Eine Constraint, die enger sitzt als die UI, macht aus der naechsten
-- Copy-Entscheidung einen fehlgeschlagenen Speichervorgang.
alter table public.events drop constraint if exists events_text_length_check;
alter table public.events add constraint events_text_length_check
  check (
    length(title) <= 200
    and length(location) <= 500
    and length(description) <= 5000
    and length(motto) <= 200
    and length(dresscode) <= 200
  );
