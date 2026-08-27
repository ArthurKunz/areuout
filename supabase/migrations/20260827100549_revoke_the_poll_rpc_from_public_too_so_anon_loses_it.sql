-- Nachtrag zu 20260827100530. `revoke ... from anon` allein wirkt nicht: Postgres
-- vergibt EXECUTE auf eine neue Funktion automatisch an PUBLIC, und anon erbt es von
-- dort. Nach dem Revoke stand has_function_privilege('anon', ...) deshalb weiterhin auf
-- true — aufgefallen ist es nur, weil nach dem Schritt geprüft wurde.
--
-- Dieselbe Reihenfolge wie in 20260809120000_lock_down_storage_and_anon_rpcs.sql:
-- erst PUBLIC und anon das Recht nehmen, dann authenticated ausdruecklich wieder
-- geben, weil auch dessen Recht bis eben aus PUBLIC kam.
revoke execute on function public.get_party_pools_by_invite_code(text) from public, anon;
grant execute on function public.get_party_pools_by_invite_code(text) to authenticated;
