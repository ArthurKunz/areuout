-- Melden per E-Mail: jede neue Meldung ruft die Edge Function report-email auf, die
-- Arthur ueber Resend eine Mail schickt (Schritt 13b, Zusage "innerhalb von 24 Stunden").
--
-- Feuer und vergessen: net.http_post stellt die Anfrage nur in die Warteschlange von
-- pg_net, gesendet wird nach dem COMMIT. Eine zurueckgerollte Meldung schickt nichts, und
-- die Antwort der Funktion kann die Meldung nie scheitern lassen. Faellt schon das Einreihen
-- aus (kein Geheimnis im Vault, pg_net kaputt), faengt der innere Block das ab: die
-- Meldung wird trotzdem gespeichert, es bleibt eine Warnung im Log.
--
-- Die Funktion prueft den Header x-report-secret gegen ihr Geheimnis REPORT_EMAIL_SECRET.
-- Derselbe Wert liegt im Vault als report_email_secret und wird erst beim Aufruf gelesen,
-- steht also in keiner Datei und in keinem Trigger-Argument (anders als bei einem Database
-- Webhook). Angelegt per vault.create_secret mit Zufallswert, von Arthur ins Dashboard
-- kopiert.
--
-- Gesendet werden nur id, kind, reason, created_at (Datenschutz, Abschnitt 7).
-- Hoechstens 20 Mails pro Melder in 24 Stunden: AFTER INSERT feuert nur fuer wirklich
-- eingefuegte Zeilen, und reports_cap_per_day laesst nicht mehr zu.
--
-- pg_net darf von anon und authenticated nicht aufrufbar sein: sonst koennte jeder die
-- Datenbank beliebige HTTP-Anfragen stellen lassen. Die beiden REVOKEs unten wirken
-- NICHT: supabase_admin besitzt das Schema net und gibt USAGE an anon und authenticated
-- und EXECUTE an PUBLIC selbst, postgres kann das nicht zuruecknehmen (geprueft am
-- 15.10.2026). Geschlossen ist der Weg trotzdem: die Data API zeigt nur public und
-- graphql_public (net und extensions antworten PGRST106), und keine Funktion in public
-- fuehrt dynamisches SQL aus oder ruft net auf. Stehen gelassen, weil sie so gelaufen sind.

begin;

create extension if not exists pg_net with schema extensions;

revoke usage on schema net from anon, authenticated;
revoke execute on all functions in schema net from anon, authenticated;

create function private.email_new_report()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  begin
    perform net.http_post(
      url := 'https://desolyjfpbxlydbdqixp.supabase.co/functions/v1/report-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-report-secret', (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'report_email_secret')),
      body := jsonb_build_object('id', new.id, 'kind', new.kind, 'reason', new.reason, 'created_at', new.created_at),
      timeout_milliseconds := 5000);
  exception when others then
    raise warning 'report email not queued for %: %', new.id, sqlerrm;
  end;
  return null;
end;
$function$;

revoke all on function private.email_new_report() from public;

create trigger reports_email_new
  after insert on public.reports
  for each row execute function private.email_new_report();

commit;
