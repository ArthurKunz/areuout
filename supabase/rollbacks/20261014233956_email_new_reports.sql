-- Rollback zu supabase/migrations/20261014233956_email_new_reports.sql.
-- Danach keine Mails mehr zu neuen Meldungen. Von Hand dazu: die Edge Function
-- report-email loeschen (Dashboard, Edge Functions), das Vault-Geheimnis
-- report_email_secret und das Edge-Function-Geheimnis REPORT_EMAIL_SECRET entfernen.
-- pg_net nur dann mit loeschen, wenn bis dahin nichts anderes es benutzt.

begin;

drop trigger reports_email_new on public.reports;
drop function private.email_new_report();
drop extension pg_net;

commit;
