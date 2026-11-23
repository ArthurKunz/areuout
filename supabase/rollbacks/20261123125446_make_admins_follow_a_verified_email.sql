-- Rollback zu supabase/migrations/20261123125446_make_admins_follow_a_verified_email.sql.
-- Entfernt die Bindung an die E-Mail-Adresse. Bestehende Eintraege in private.admins bleiben
-- (wer jetzt Admin ist, bleibt es bis zum Loeschen des Kontos).

drop trigger if exists profiles_admin_from_email on public.profiles;
drop function if exists private.admin_from_email();
drop table if exists private.admin_emails;
