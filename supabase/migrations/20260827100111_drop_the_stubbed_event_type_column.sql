-- events.event_type war seit dem Anlegen der Tabelle am 13.06.2026 ein Stub: nullable,
-- ohne UI, ohne CHECK, in beiden vorhandenen Zeilen NULL. Kein App-Code liest oder
-- schreibt sie, keine Funktion nennt sie, keine Constraint und kein Index hängen daran
-- (geprüft über pg_proc, pg_constraint und pg_indexes).
--
-- Eine Spalte ohne CHECK ist ausserdem genau das, wovor CLAUDE.md warnt: der anon-Key
-- liegt im Browser-Bundle, also kann jeder Angemeldete in ein solches Feld schreiben,
-- was er will. Solange die Spalte nichts tut, ist Löschen die ehrlichere Antwort als
-- eine nachträgliche Constraint.
alter table public.events drop column event_type;
