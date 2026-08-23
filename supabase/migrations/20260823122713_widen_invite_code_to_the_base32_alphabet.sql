-- generateInviteCode erzeugt ab jetzt 12 Zeichen aus Crockfords base32 statt 10 Hex.
--
-- Der Grund ist nicht die Laenge allein, sondern was gemessen wurde: die anonyme
-- Abfrage get_party_by_invite_code hat kein Rate-Limit. 150 von 150 Anfragen wurden
-- mit 55/s von einem einzelnen Rechner beantwortet, keine einzige 429. Ein Angreifer
-- sucht keine bestimmte Party, sondern irgendeine, also sinkt der Aufwand mit jeder
-- Party in der Datenbank. Bei 100.000 Partys und 2000 Anfragen/s waeren 40 Bit in
-- rund 90 Minuten durchprobiert. 60 Bit machen daraus etwa 180 Jahre.
--
-- Die Constraint muss beide Alphabete zulassen: die zwei bestehenden Codes stammen aus
-- der Hex-Zeit ('8a9c1a4a' mit 8 Zeichen, '56a0a440da' mit 10) und bleiben absichtlich
-- unveraendert - geteilte Links nachtraeglich ungueltig zu machen waere in Produktion
-- die falsche Gewohnheit.
--
-- Das Zeichenkleid deckt genau die 32 Symbole ab: 0-9, dann a-z ohne i, l, o und u.
-- Die vier fallen raus, weil sie beim Vorlesen oder Abtippen verwechselt werden.
-- Hex ist darin vollstaendig enthalten, die Altcodes passen also weiter.

alter table public.events drop constraint if exists events_invite_code_check;
alter table public.events add constraint events_invite_code_check
  check (invite_code ~ '^[0-9a-hj-km-np-tv-z]{8,32}$');
