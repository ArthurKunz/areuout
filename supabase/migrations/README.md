# Zum Stand dieses Ordners

**Kurz: dieser Ordner ist nicht die Wahrheit über die Datenbank.** Er ist eine
unvollständige Teilmenge davon. Solange es genau ein Supabase-Projekt gibt, merkt man
davon nichts — der Tag, an dem es weh tut, ist der, an dem eine Staging-Umgebung
gebraucht wird, das Projekt neu aufgesetzt werden muss oder ein Backup zurückgespielt
wird.

Stand 19.09.2026, gezählt gegen `supabase_migrations.schema_migrations` auf der
Live-Datenbank:

| | Anzahl |
|---|---|
| Dateien in diesem Ordner | 51 |
| Migrationen auf der Datenbank | 73 |
| davon **nur** hier, nie angewendet | 0 |

Die Zuordnung der beiden Spalten ist **nicht** über die Dateinamen möglich: 27 Dateien
tragen eine Version, die so auf der Datenbank nicht steht, obwohl ihr Inhalt dort
angewendet ist. Das ist dieselbe Abweichung, die weiter unten für zwei Dateien
beschrieben ist — sie betrifft in Wahrheit deutlich mehr. Wer eine belastbare Zahl
für „nur auf der Datenbank" braucht, muss über `statements` vergleichen, nicht über
die Namen.

Die vier jüngsten Dateien (`20260918214647_add_a_motto_to_a_party.sql`,
`20260918214737_hand_out_the_motto_with_the_invite.sql`,
`20260919112857_add_a_dresscode_to_a_party.sql`,
`20260919112921_hand_out_the_dresscode_with_the_invite.sql`) gehören zum Motto- und zum
Dresscode-Feature und tragen die Versionen, unter denen sie tatsächlich angewendet
wurden — die Regel ganz unten, befolgt.

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

## Warum zum Fragen-Feature keine Migration hier liegt

Die Fragen (Version 1.4.0) haben keine eigenen Tabellen bekommen. Eine Frage ist
eine Zeile in `pools` mit `type = 'text_only'`, eine Antwort eine Zeile in
`pool_responses` mit `option_id = null`. Beides sah die Datenbank schon vor:
`pools_type_check` erlaubt `'text_only'` seit der ersten Pools-Migration,
`text_response` steht samt Längen-CHECK in `pool_responses`,
`get_pool_responses_by_event` gibt den Freitext heraus und
`set_single_pool_response` schreibt den Antwortwechsel in einer Transaktion.

Wer also nach einer Tabelle `questions` sucht, sucht vergeblich — die Trennung der
beiden Features passiert im Code, in `features/parties/services/questions.service.ts`
und im Typfilter in `pools.service.ts`.

## Die beiden Mitbring-Migrationen

`20260919132250_create_the_mitbring_list.sql` und
`20260919132303_hand_out_the_mitbring_list_and_its_claims.sql` (Version 1.5.0) legen
`mitbring_items` und `mitbring_claims` an, samt RLS und den beiden RPCs. Die
Dateinamen tragen die Versionen, unter denen sie tatsächlich angewendet wurden —
so, wie die Regel oben es verlangt.

Das Stück, das beim Lesen leicht untergeht: `mitbring_claims.event_id` ist
absichtlich verdoppelt, damit `unique (event_id, claimed_by)` „eine Beanspruchung
pro Person und Party" halten kann. Abgesichert wird diese Verdopplung durch den
zusammengesetzten Fremdschlüssel auf `(item_id, event_id)` — ohne ihn liesse sich
die Regel mit einer fremden `event_id` umgehen.
