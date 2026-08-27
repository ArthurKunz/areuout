# Zum Stand dieses Ordners

**Kurz: dieser Ordner ist nicht die Wahrheit über die Datenbank.** Er ist eine
unvollständige Teilmenge davon. Solange es genau ein Supabase-Projekt gibt, merkt man
davon nichts — der Tag, an dem es weh tut, ist der, an dem eine Staging-Umgebung
gebraucht wird, das Projekt neu aufgesetzt werden muss oder ein Backup zurückgespielt
wird.

Stand 27.08.2026, geprüft gegen `list_migrations` auf der Live-Datenbank:

| | Anzahl |
|---|---|
| Dateien in diesem Ordner | 33 |
| Migrationen auf der Datenbank | 55 |
| davon **nur** auf der Datenbank, ohne Datei hier | 22 |
| davon **nur** hier, nie angewendet | 0 |

## Die drei gefährlichen Dateien sind weg

Am 27.08.2026 gelöscht, nachdem sie seit dem 21.08. als Entscheidung offenstanden:

| Gelöschte Datei | Was sie beim Abspielen getan hätte |
|---|---|
| `20260401120000_add_gender_height_relationship.sql` | `gender`, `height`, `relationship` per `add column if not exists` **lautlos** zurückbringen — `gender` steht in CLAUDE.md aus rechtlichen Gründen bei Minderjährigen unter „Not in V1", und die Datenschutzerklärung nennt es ausdrücklich als nicht erhoben |
| `20260402120000_add_hobbies_to_profiles.sql` | dasselbe mit `hobbies` |
| `20260613120000_create_events_and_rsvps.sql` | mit „relation exists" abbrechen. Darin stand außerdem die längst ersetzte Policy `events_select_public USING (true)` — die Fassung, in der jede Party für jeden lesbar war |

Damit kann ein versehentliches `supabase db push` keine Spalte mehr
zurückbringen, die bewusst entfernt wurde.

## Zwei Dateien tragen noch eine andere Version als die Datenbank

`20260602120000_remove_consent_and_explore.sql` liegt auf der Datenbank als
`20260602114136`, `20260602121000_remove_profile_extra_fields.sql` als
`20260602120114`. Beide sind **angewendet**; nur die Nummer im Dateinamen stimmt
nicht. `supabase migration list --linked` zeigt sie deshalb weiterhin als
Abweichung an.

## Warum die Abweichung entstanden ist

Die 22 Migrationen ohne Datei wurden über die Supabase-Oberfläche bzw. per MCP direkt
auf der Datenbank angewendet. Dabei vergibt Supabase die Version selbst und legt keine
Datei an. Der vollständige SQL-Text jeder einzelnen liegt weiterhin auf der Datenbank
in `supabase_migrations.schema_migrations.statements` — verloren ist also nichts, es
steht nur nicht im Repository.

## Wie man das sauber repariert

Ein Befehl, der die Datenbank selbst nicht anfasst, aber die Migrations-Buchführung
neu schreibt — deshalb bewusst nicht nebenbei ausgeführt:

```bash
supabase db pull          # fragt nach dem Datenbank-Passwort
```

Das erzeugt eine Baseline-Migration mit dem aktuellen Schema und markiert sie als
angewendet. Danach:

1. `supabase migration list --linked` erneut ausführen: links und rechts müssen
   danach Zeile für Zeile übereinstimmen.
2. Ergebnis einchecken.

Der erste Schritt der alten Anleitung — die nie angewendeten Dateien löschen — ist
am 27.08.2026 erledigt worden.

## Regel für alles Weitere

Neue Änderungen ab jetzt **immer** als Datei hier anlegen und den Dateinamen mit der
Version verwenden, unter der sie tatsächlich angewendet wird. Die beiden jüngsten
Migrationen (`20260820230141_…`, `20260820230226_…`) sind genau so benannt — ihre
Dateinamen tragen die Versionsnummern, die auf der Datenbank stehen, nicht die
Uhrzeit, zu der sie geschrieben wurden.
