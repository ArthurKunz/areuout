-- Die Mitbring-Liste ist weg (Schritt 12 des Redesigns, entschieden am 08.10.2026).
-- Die App ruft keine dieser Funktionen und keine dieser Tabellen mehr auf; beide
-- Tabellen waren am 09.10.2026 leer.
--
-- Erst NACH dem Merge in main anwenden, wenn das Vercel-Deployment auf Ready steht:
-- vorher liest die alte App auf main noch daraus.
--
-- Kein `cascade` und kein `if exists`: haengt doch noch etwas Unbekanntes daran, soll
-- die Migration laut scheitern, statt es stillschweigend mitzunehmen. Policies,
-- Constraints und Indizes gehen mit ihren Tabellen. mitbring_claims zuerst, weil ihr
-- Fremdschluessel auf mitbring_items zeigt.

drop function public.get_mitbring_claims_by_event(uuid);
drop function public.get_party_mitbring_by_invite_code(text);

drop table public.mitbring_claims;
drop table public.mitbring_items;
