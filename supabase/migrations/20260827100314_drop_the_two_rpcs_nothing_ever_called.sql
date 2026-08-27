-- Zwei Funktionen, die kein Aufruf im Code je erreicht hat.
--
-- get_rsvp_count(uuid) zählt die Zusagen einer Party. Die Oberfläche nimmt dafür
-- get_rsvp_counts_by_status (Detail- und Einladungsseite) und
-- get_rsvp_counts_for_events (Partyliste, eine Runde für alle Partys). Sie ist
-- ausserdem für anon ausführbar und taucht deshalb im Security-Advisor auf — mit dem
-- Löschen ist dieser Punkt erledigt statt nur entschärft.
--
-- get_attendee_avatars_for_events(uuid[]) war für die Gesichter auf den Partykarten
-- gedacht. Die Migration vom 21.08. (read_the_party_list_in_one_go) hält selbst fest,
-- dass sie "genau dafür gebaut und dann nie" benutzt wurde: die Karten lesen ihre
-- Gesichter aus get_event_attendees_for_events mit.
--
-- Vor dem Löschen geprüft: kein Aufruf im Repo, keine andere Funktion, keine Policy
-- und keine View, die eine der beiden nennt.
drop function if exists public.get_rsvp_count(uuid);
drop function if exists public.get_attendee_avatars_for_events(uuid[]);
