-- Rollback zu supabase/migrations/20261014200539_create_reports.sql.
-- Loescht alle Meldungen. Vorher exportieren, wenn sie noch gebraucht werden. Danach die
-- Typen neu erzeugen.

begin;

drop function public.submit_report(text, uuid, uuid, text, text);
drop table public.reports;
drop function private.cap_reports_per_day();

commit;
