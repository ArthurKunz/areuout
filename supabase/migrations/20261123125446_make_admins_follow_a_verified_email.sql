-- Admins an eine E-Mail-Adresse binden (Arthur, 2026-11-23). Bisher stand die Konto-ID in
-- private.admins; mit dem Loeschen des Kontos verschwand der Eintrag (ON DELETE CASCADE auf
-- profiles), und ein neues Konto mit derselben Adresse war kein Admin mehr.
--
-- Jetzt:
-- - private.admin_emails: die Adressen, deren Konto Admin sein soll (klein geschrieben).
-- - Legt jemand ein Profil an, traegt private.admin_from_email() das Konto in private.admins
--   ein, wenn seine Adresse in admin_emails steht UND bestaetigt ist (email_confirmed_at).
--   Eine unbestaetigte Anmeldung mit fremder Adresse wird so nie Admin.
-- - Alle bestehenden Profile werden einmal nachgetragen.
--
-- is_admin(), queue_admin_push() und alle Admin-Funktionen bleiben unveraendert: sie lesen
-- weiter private.admins. Fehler im Trigger werden zur Warnung, damit nie ein Profil an ihm
-- scheitert. Die Tabelle ist fuer anon und authenticated nicht erreichbar.
-- Rollback: supabase/rollbacks/20261123125446_make_admins_follow_a_verified_email.sql

create table private.admin_emails (
  email text primary key check (email = lower(email)),
  added_at timestamptz not null default now()
);
revoke all on table private.admin_emails from public, anon, authenticated;

insert into private.admin_emails (email) values ('azzuro.kunz@gmail.com');

create function private.admin_from_email()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  begin
    insert into private.admins (user_id)
    select new.id
    from auth.users u
    where u.id = new.id
      and u.email_confirmed_at is not null
      and lower(u.email) in (select e.email from private.admin_emails e)
    on conflict do nothing;
  exception when others then
    raise warning 'admin from email failed for %: %', new.id, sqlerrm;
  end;
  return null;
end;
$function$;

revoke all on function private.admin_from_email() from public, anon, authenticated;

create trigger profiles_admin_from_email
  after insert on public.profiles
  for each row
  execute function private.admin_from_email();

-- Einmal nachtragen: wer schon ein Profil hat und passt.
insert into private.admins (user_id)
select p.id
from public.profiles p
join auth.users u on u.id = p.id
where u.email_confirmed_at is not null
  and lower(u.email) in (select e.email from private.admin_emails e)
on conflict do nothing;
