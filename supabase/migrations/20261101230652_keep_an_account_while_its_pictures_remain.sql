-- Storage-Dateien verschwinden nicht mit dem Konto (SCHEMA.md 5 und 7): ein SQL-delete
-- auf storage.objects ließe die Datei in S3 liegen, und weder delete_self noch das
-- Dashboard rufen die Storage-API. Deshalb räumt der Client vorher über die Storage-API
-- auf, und dieser Trigger weigert sich, ein Konto zu löschen, solange in seinen beiden
-- Ordnern noch etwas liegt. Er gilt für jeden Weg, der in auth.users endet.
create or replace function private.refuse_user_delete_while_files_remain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from storage.objects
    where bucket_id in ('avatars', 'event-backgrounds')
      and name like old.id::text || '/%'
  ) then
    raise exception 'Ein paar deiner Bilder sind noch da. Versuch es gleich nochmal.'
      using errcode = 'PT409',
            hint = 'Remove avatars/{id}/ and event-backgrounds/{id}/ through the Storage API first.';
  end if;
  return old;
end;
$$;

revoke execute on function private.refuse_user_delete_while_files_remain() from public, anon, authenticated;

create trigger users_keep_while_files_remain
  before delete on auth.users
  for each row execute function private.refuse_user_delete_while_files_remain();
