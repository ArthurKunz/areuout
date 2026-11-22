-- Native Redesign (Arthur, 2026-11-22): Partys des Agents bleiben beim Systemkonto
-- "areuout" (Anzeige "von areuout" plus Veranstalter), Admins dürfen sie aber bearbeiten wie
-- ein Host. update_party ändert dafür nur seine WHERE-Bedingung:
--   vorher:  id = p_id and host_id = auth.uid()
--   jetzt:   id = p_id and (host_id = auth.uid()
--                           or (private.is_admin() and host_id = private.agent_system_account()))
-- Partys normaler Nutzer bleiben für Admins gesperrt. Gelöscht werden Agent-Partys weiter nur
-- über remove_agent_event (sperrt dabei die Quelle).
--
-- Die Funktion wird aus ihrer gespeicherten Fassung neu geschrieben, mit genau dieser einen
-- Ersetzung; findet sich die Stelle nicht, bricht die Migration ab und ändert nichts.
--
-- Am selben Tag, nicht Teil dieser Datei: Arthurs Konto (7f316944-…) per SQL in
-- private.admins eingetragen. Die Liste war leer, sein früheres Admin-Konto gibt es nicht mehr.
do $migration$
declare
  v_def text;
  c_old constant text := 'where id = p_id and host_id = v_host;';
  c_new constant text := 'where id = p_id and (host_id = v_host or (private.is_admin() and host_id = private.agent_system_account()));';
begin
  v_def := pg_get_functiondef('public.update_party(uuid, text, boolean, timestamp with time zone, timestamp with time zone, text, double precision, double precision, text, text, text, text, integer, jsonb, jsonb, numeric, text, text, text, text, boolean, text)'::regprocedure);
  if (length(v_def) - length(replace(v_def, c_old, ''))) / length(c_old) <> 1 then
    raise exception 'update_party: WHERE-Bedingung nicht genau einmal gefunden';
  end if;
  execute replace(v_def, c_old, c_new);
end
$migration$;
