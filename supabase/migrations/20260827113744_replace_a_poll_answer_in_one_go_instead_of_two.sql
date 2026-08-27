-- Fund B2. upsertPoolResponse in pools.service.ts löschte die alte Antwort und fügte
-- danach die neue ein — in zwei getrennten HTTP-Anfragen. Das Löschen ist damit
-- committet, bevor das Einfügen überhaupt losläuft. Scheitert das Einfügen (Netz weg,
-- Fremdschlüssel, RLS), steht der Gast ohne Antwort da, obwohl er eine hatte.
--
-- Nachgestellt vor dieser Migration: Antwort "Chips" gesetzt, dann auf eine Option
-- gewechselt, die zu einer anderen Umfrage gehört. Der zusammengesetzte
-- Fremdschlüssel (pool_id, option_id) lehnt sie zu Recht ab — übrig blieben NULL
-- Antworten.
--
-- security INVOKER, nicht DEFINER: Die Funktion braucht keine Sonderrechte. Sie läuft
-- unter dem anfragenden Konto, RLS gilt also unverändert weiter — pool_responses_delete_own
-- erlaubt nur die eigene Zeile, pool_responses_insert_member verlangt Mitgliedschaft
-- in der Party. Was die Funktion beisteuert, ist allein die Klammer: beide Anweisungen
-- laufen in EINER Transaktion, und scheitert die zweite, ist die erste nie geschehen.
--
-- auth.uid() statt eines Parameters: Der Aufrufer soll gar nicht erst behaupten können,
-- jemand anderes zu sein. RLS würde es ohnehin abweisen, aber ein Parameter, den es
-- nicht gibt, kann auch nicht falsch gefüllt werden.
create or replace function public.set_single_pool_response(
  p_pool_id uuid,
  p_option_id uuid,
  p_text_response text
)
returns void
language plpgsql
security invoker
set search_path to 'public'
as $function$
begin
  delete from pool_responses
   where pool_id = p_pool_id
     and user_id = auth.uid();

  insert into pool_responses (pool_id, user_id, option_id, text_response)
  values (p_pool_id, auth.uid(), p_option_id, p_text_response);
end;
$function$;

revoke execute on function public.set_single_pool_response(uuid, uuid, text) from public, anon;
grant execute on function public.set_single_pool_response(uuid, uuid, text) to authenticated;
