-- Push, Teil 5a: private.queue_push stellt eine Mitteilung an eine Person in die
-- Warteschlange von pg_net. Die Edge Function send-push schickt sie an Apple. Aufgerufen
-- wird die Funktion von den Push-Triggern und RPCs der folgenden Migrationen (neue Anfrage,
-- angenommen, abgelehnt), nie von der App.
--
-- Uebersprungen, ohne Aufruf und ohne Fehler, wird: kein Empfaenger, Empfaenger ist der
-- Ausloeser, Empfaenger ohne Geraet (push_tokens), eine Blockierung in einer der beiden
-- Richtungen (private.is_blocked_between), eine Party, die es nicht gibt oder die schon
-- vorbei ist (private.party_visible_until).
--
-- Feuer und vergessen wie private.email_new_report: net.http_post stellt die Anfrage nur in
-- die Warteschlange, gesendet wird nach dem COMMIT. Eine zurueckgerollte Aktion schickt
-- nichts, und die Antwort von send-push kann die Aktion nie scheitern lassen. Jeder Fehler
-- in der Funktion (pg_net, Vault, Tabelle) wird im inneren Block zur Warnung: die Anfrage,
-- das Annehmen und das Ablehnen gelingen trotzdem. Die Warnung nennt nur die Party-ID, nie
-- Token, Titel oder Namen.
--
-- Das Geheimnis fuer den Header x-push-secret liegt im Vault als push_secret (derselbe Wert
-- wie PUSH_SECRET der Edge Function) und wird erst beim Aufruf gelesen, steht also in keiner
-- Datei. Fehlt es, wird nichts eingereiht.
--
-- Inhalt: die Token des Empfaengers (hoechstens 10, register_push_token), der Partytitel
-- (send-push nimmt hoechstens 100 Zeichen), ein fester Satz des Aufrufers und als data nur
-- die Party-ID. Nie ein Name, eine Adresse oder eine Uhrzeit (CLAUDE.md).
--
-- net.http_request_queue (mit dem Header) und net._http_response (die Antwort mit den toten
-- Token, 6 Stunden) gehoeren supabase_admin, der PUBLIC alle Rechte gibt; postgres kann das
-- nicht zuruecknehmen (SCHEMA.md 9c). Erreichbar sind sie fuer anon und authenticated
-- trotzdem nicht: die Data API zeigt net nicht, und keine Funktion in public liest net.
-- queue_push liegt in private und ist nur fuer den Owner ausfuehrbar.

begin;

create function private.queue_push(p_recipient uuid, p_actor uuid, p_event_id uuid, p_body text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_tokens text[];
  v_title text;
  v_event_date timestamptz;
  v_ends_at timestamptz;
  v_secret text;
begin
  begin
    if p_recipient is null or p_recipient = p_actor then
      return;
    end if;

    select array_agg(pt.token) into v_tokens
    from public.push_tokens pt
    where pt.user_id = p_recipient;
    if v_tokens is null then
      return;
    end if;

    if private.is_blocked_between(p_recipient, p_actor) then
      return;
    end if;

    select e.title, e.event_date, e.ends_at
      into v_title, v_event_date, v_ends_at
    from public.events e
    where e.id = p_event_id;
    if not found or now() >= private.party_visible_until(v_event_date, v_ends_at) then
      return;
    end if;

    select s.decrypted_secret into v_secret
    from vault.decrypted_secrets s
    where s.name = 'push_secret';
    if v_secret is null then
      raise warning 'push not queued for %: no secret', p_event_id;
      return;
    end if;

    perform net.http_post(
      url := 'https://desolyjfpbxlydbdqixp.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-secret', v_secret),
      body := jsonb_build_object(
        'tokens', to_jsonb(v_tokens),
        'title', left(v_title, 100),
        'body', p_body,
        'data', jsonb_build_object('event_id', p_event_id)),
      -- send-push fragt erst den Produktions-, dann den Sandbox-Host, je bis zu 10 Sekunden.
      timeout_milliseconds := 20000);
  exception when others then
    raise warning 'push not queued for %: %', p_event_id, sqlerrm;
  end;
end;
$function$;

revoke all on function private.queue_push(uuid, uuid, uuid, text) from public, anon, authenticated;

commit;
