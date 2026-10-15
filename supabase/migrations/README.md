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

**Entfernt in Schritt 12 des Redesigns.** `20261011114515_drop_the_mitbring_list.sql`
löscht beide Tabellen und beide RPCs wieder. Sie lief am 11.10.2026 im SQL-Editor, nach
dem Merge in `main` und erst, als das Vercel-Deployment auf Ready stand, weil die alte
App bis dahin daraus las. Details im Abschnitt zu Schritt 12 unten. Die beiden Dateien
unten bleiben als Geschichte stehen. Ein erneutes Abspielen in Namensreihenfolge legt
die Tabellen an und löscht sie wieder.

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

## Die beiden Create-Party-Migrationen

`20261003201436_add_create_party_function.sql` und
`20261003201448_cap_polls_and_options.sql` (Schritt 3 des Redesigns) legen
`create_party` an — Party, Umfragen samt Optionen und Fragen in einem atomaren
Aufruf — und die beiden Trigger, die höchstens 5 Umfragen und 5 Fragen pro Party und
höchstens 10 Optionen pro Umfrage zulassen. Die Dateinamen tragen die Versionen, unter
denen sie tatsächlich angewendet wurden — so, wie die Regel oben es verlangt. Warum es
so gebaut ist, steht in `SCHEMA.md`, Abschnitt 9.

## Die Edit-Party-Migration

`20261004164021_add_update_party_function.sql` (Schritt 4 des Redesigns) legt
`update_party` an — das Gegenstück zu `create_party` für das neue Bearbeiten-Formular:
Party, Umfragen samt Optionen und Fragen in einem atomaren Aufruf. Warum es so gebaut
ist, steht in `SCHEMA.md`, Abschnitt 9.

Die Ausnahme von der Regel oben: Diese Migration wurde am 04.10.2026 im SQL-Editor von
Supabase ausgeführt, nicht über `apply_migration`. Der SQL-Editor trägt nichts in die
Migrationshistorie ein, deshalb steht sie **nicht** in `list_migrations` und hat keine
Version, die der Dateiname tragen könnte. Der Dateiname trägt die Uhrzeit der Datenbank
kurz nach dem Ausführen. Geprüft am selben Tag: der Funktionskörper auf der Datenbank
ist Zeichen für Zeichen derselbe wie in der Datei (gleicher md5 über `prosrc`).

## Die Migrationen zu Schritt 7

`20261005130113_cap_answers_at_25_characters.sql` legt den CHECK
`pool_responses_text_max_25` an — eine Antwort auf eine Frage hat höchstens 25 Zeichen,
bisher hielt das nur die Oberfläche. `20261005130127_add_get_party_poll_data.sql` legt
`get_party_poll_data` an: Umfragen und Fragen samt Stimmen und Antworten, auf einer
privaten Party nur für Mitglieder. `20261005133109_add_get_party_guest_list.sql` legt
`get_party_guest_list` an: die Gästeliste mit vollen Namen für jeden angemeldeten
Betrachter; `get_party_guests` bleibt unverändert.
`20261005161226_revoke_get_party_polls.sql` nimmt `get_party_polls` das `EXECUTE` für
`authenticated`, nachdem Schritt 7 gemergt war — die Funktion gab einem Fremden Fragen,
Optionen und Stimmenzahlen einer privaten Party heraus; `main` rief sie nie auf. Alle
vier über `apply_migration`, die Dateinamen tragen
die Versionen der Datenbank. Warum es so gebaut ist, steht in `SCHEMA.md`, Abschnitt 9a.

## Die Migration vor Schritt 8

`20261005162836_stop_moving_an_rsvp_to_another_party.sql` legt den Trigger
`rsvps_keep_party_and_owner` an: Bei einem UPDATE auf `rsvps` dürfen sich `event_id` und
`user_id` nicht mehr ändern (42501). Vorher ließ `rsvps_update_own` zu, die eigene
Antwort auf eine fremde private Party umzuhängen — damit war man Mitglied und konnte die
Adresse lesen. Der Upsert der App schreibt dieselben Werte zurück und funktioniert
weiter. Über `apply_migration`, der Dateiname trägt die Version der Datenbank. Warum es
so gebaut ist, steht in `SCHEMA.md`, Abschnitt 8.

## Die Migrationen zu Schritt 8 (Beitrittsanfragen)

Sieben Dateien, in der Reihenfolge, in der sie angewendet wurden:

| Datei | Was sie anlegt | Wie angewendet |
|---|---|---|
| `20261005164300_create_join_requests.sql` | Tabelle `join_requests`, RLS, drei Policies, keine Rechte für `anon`, kein INSERT/UPDATE für `authenticated` | `apply_migration` |
| `20261005164336_add_request_to_join_function.sql` | `request_to_join` | `apply_migration` |
| `20261005170000_add_accept_join_request_function.sql` | `accept_join_request` | SQL-Editor |
| `20261005165140_add_get_party_join_requests.sql` | `get_party_join_requests` | `apply_migration` |
| `20261005171000_clean_up_join_requests.sql` | die Trigger `rsvps_drop_join_request` und `events_drop_join_requests_when_public` | SQL-Editor |
| `20261005165800_show_pending_requests_in_map_functions.sql` | `my_status = 'requested'` in `get_my_parties`, `get_explore_parties`, `get_party_detail` | `apply_migration` |
| `20261005165822_say_teilnehmen_when_requesting_a_public_party.sql` | neuer Wortlaut einer Fehlermeldung in `request_to_join` | `apply_migration` |

Das MCP-Werkzeug lehnt Anweisungen mit DELETE ab, deshalb hat Arthur die beiden
Editor-Migrationen selbst im SQL-Editor ausgeführt. Anders als bei der
Edit-Party-Migration oben haben beide ihre Version per INSERT in
`supabase_migrations.schema_migrations` eingetragen bekommen, sie stehen also in
`list_migrations`. Ihre Versionen sind von Hand gewählt und liegen deshalb **nach**
Migrationen, die eigentlich später kamen: Nach Dateinamen sortiert läuft
`accept_join_request` erst nach `get_party_join_requests` und nach der Änderung der
Kartenfunktionen. Keine der drei hängt von einer anderen ab außer von der Tabelle, ein
erneutes Abspielen in Namensreihenfolge geht also. Warum es so gebaut ist, steht in
`SCHEMA.md`, Abschnitt 9b.

## Die Migration zu Schritt 5 (Explore)

| Datei | Was sie ändert | Wie angewendet |
|---|---|---|
| `20261005172101_show_the_full_host_name.sql` | `get_my_parties`, `get_explore_parties`, `get_party_detail` geben den vollen Nachnamen des Hosts zurück, auch ohne Zugang (vorher nur den Anfangsbuchstaben) | `apply_migration` |

Gleiche Rückgabeform, CREATE OR REPLACE, Rechte bleiben. Position, Adresse, `is_exact`
und `my_status` sind unverändert. `private.visible_lastname` bleibt, `get_party_guests`
kürzt weiter. Warum, steht in `SCHEMA.md`, Abschnitt 8.

## Die Migration zum Preis (Schritt 11c)

| Datei | Was sie aendert | Wie angewendet |
|---|---|---|
| `20261008203433_add_an_optional_price_to_a_party.sql` | Spalte `events.price` (`numeric(6,2)`, nullable) samt `events_price_check`; `get_party_detail`, `get_party_by_invite_code`, `create_party` und `update_party` geben den Preis weiter bzw. nehmen ihn entgegen | SQL-Editor |

Die Ausnahme von der Regel oben, wie schon bei der Edit-Party-Migration: Diese Migration
wurde am 08.10.2026 im SQL-Editor von Supabase ausgefuehrt, nicht ueber `apply_migration`.
Der SQL-Editor traegt nichts in die Migrationshistorie ein, sie steht also **nicht** in
`list_migrations`. Der Dateiname traegt die Uhrzeit der Datenbank kurz nach dem Ausfuehren
(`20261008203433`).

Drei Dinge, die beim Lesen leicht untergehen:

1. **Alle vier Funktionen per DROP + CREATE.** Weder eine `RETURNS TABLE`-Form noch eine
   Parameterliste laesst sich mit `create or replace` aendern. Vorher dreifach geprueft und
   leer: `pg_depend`, die Rumpftexte aller uebrigen Funktionen, alle Views, alle Policies
   und alle Spalten-Defaults nennen keine der vier. Deshalb kein `cascade`.
2. **Der DROP nimmt die Grants mit.** `get_party_by_invite_code` ist dabei die
   gefaehrliche: sie haelt `EXECUTE` fuer `anon` **und** fuer `PUBLIC`, und sie ist als
   einzige der vier auf `search_path = public` statt `''` gesetzt. Ohne beides ist die
   Einladungsseite ohne Konto tot. Vor und nach der Migration wurden Owner, SECURITY,
   `search_path`, Volatilitaet, Sprache und ACL aller vier verglichen; sie sind identisch.
3. **Die CHECK ist nicht bloss Doppelung der Oberflaeche.** Die alte App schreibt `events`
   direkt ueber PostgREST, nicht ueber `create_party`/`update_party` — die Validierung in
   den Funktionen allein wuerde sie gar nicht erreichen. `price = 0` wird abgelehnt: "kein
   Preis" ist `NULL`, und 0 waere ein zweiter Weg, dasselbe zu sagen.

`p_price` steht als **letzter** Parameter und hat `DEFAULT NULL`, damit ein Aufruf ohne ihn
weiterhin aufloest. Weil die alte Funktion gedroppt und nicht daneben stehen gelassen wird,
gibt es keine Ueberladung und damit kein "function is not unique". Warum es so gebaut ist,
steht in `SCHEMA.md`, Abschnitte 8 und 9.

## Die Migration zum Enddatum (Schritt 11c)

| Datei | Was sie aendert | Wie angewendet |
|---|---|---|
| `20261008205110_cap_a_party_end_at_30_days.sql` | `create_party` und `update_party` lehnen ein `ends_at` ab, das mehr als 30 Tage nach `event_date` liegt | SQL-Editor |

Wieder im SQL-Editor ausgefuehrt, der Dateiname traegt die Uhrzeit der Datenbank kurz
danach (`20261008205110`); sie steht also nicht in `list_migrations`.

Gleiche Signatur wie vorher, also `create or replace`: kein DROP, keine Grants in Gefahr,
Owner, SECURITY, `search_path` und ACL vorher und nachher verglichen und identisch.
Geaendert ist in beiden Funktionen genau ein Block.

Der Grund: Bis Schritt 11c war `ends_at` eine reine Uhrzeit, die der Client auf einen Tag
rechnete -- ein Ende lag damit immer innerhalb eines Tages nach dem Start, ein absurd
weit entferntes war gar nicht eingebbar. Seit der Host das Enddatum selbst waehlt, schon.
Und das trifft die 24-Stunden-Regel: `private.party_visible_until` zaehlt ab dem **Ende**,
eine Party mit einem Ende in drei Monaten stuende drei Monate lang auf der Karte.

Warum keine CHECK auf der Tabelle: Eine CHECK ueber zwei Spalten wuerde auch fuer die alte
App gelten, die `events` direkt ueber PostgREST schreibt und `ends_at` weiterhin nach der
alten Regel bildet; ein Speichern koennte dort an einer Party scheitern, die bei ihrer
Anlage erlaubt war. Bestehende Zeilen werden so oder so nicht angefasst. Gespiegelt von
`MAX_PARTY_DAYS` in `features/create-party/draft.ts`, siehe die harte Regel in
`CLAUDE.md`. Warum es so gebaut ist, steht in `SCHEMA.md`, Abschnitt 9.

## Die Migration zu Schritt 8, Phase 2b (Anfragen in der App)

| Datei | Was sie ändert | Wie angewendet |
|---|---|---|
| `20261005175531_answer_party_has_room_only_for_yourself.sql` | `party_has_room` antwortet nur noch für die eigene ID, eine fremde bekommt immer `false` | `apply_migration` |

Gleiche Signatur, Sprache und `search_path`, Rechte und Policies bleiben. Alle Aufrufer
übergeben schon die eigene ID. Warum, steht in `SCHEMA.md`, Abschnitt 9b.

## Die Migrationen zu Schritt 12 (Aufräumen)

Geschrieben am 09.10.2026, angewendet zwischen dem 09.10. und dem 11.10.2026. Die
Dateinamen tragen seither die Version, unter der jede in
`supabase_migrations.schema_migrations` steht. Zu jeder Datei außer der Mitbring-Löschung
liegt ein Rollback in `supabase/rollbacks/` mit demselben Namen. Er liegt bewusst nicht
hier, weil die Supabase CLI jede `.sql`-Datei in diesem Ordner als Migration abspielen
würde.

| Datei | Was sie ändert | Wie angewendet | Version |
|---|---|---|---|
| `20261009173711_hide_the_address_24_hours_after_a_party_ends.sql` | `get_party_detail`: ab `party_visible_until` für Nicht-Hosts keine Adresse, verwischter Punkt | `apply_migration` | echt, von `apply_migration` vergeben |
| `20261009173733_hide_the_address_columns_of_events.sql` | `events`: SELECT nur noch spaltenweise, ohne `location`, `lat`, `lng` | `apply_migration` | echt, von `apply_migration` vergeben |
| `20261009180100_stop_handing_out_the_address_with_the_invite_code.sql` | `get_party_by_invite_code` ohne `location`, ohne `c_assumed_hours`, nicht mehr für PUBLIC | SQL-Editor (der Rumpf enthält ein DELETE) | von Hand gewählt, per INSERT eingetragen |
| `20261009180300_drop_a_removed_guests_votes_and_answers.sql` | Trigger `rsvps_drop_pool_responses`: ein entfernter Gast verliert Stimmen und Antworten | SQL-Editor (DELETE) | von Hand gewählt, per INSERT eingetragen |
| `20261011114515_drop_the_mitbring_list.sql` | löscht `mitbring_items`, `mitbring_claims` und ihre zwei RPCs | SQL-Editor, nach dem Merge, Deployment auf Ready | Uhrzeit der Datenbank kurz nach dem Ausführen, per INSERT eingetragen |

Die beiden `apply_migration`-Dateien trugen bis zum 11.10.2026 die Platzhalter
`20261009180000` und `20261009180200` und sind auf ihre echten Versionen umbenannt, die
Rollbacks mit ihnen. Der SQL-Editor trägt nichts in die Migrationshistorie ein. Für die
drei Editor-Migrationen wurde die Version deshalb am 11.10.2026 nachträglich per INSERT
von Version und Name in `supabase_migrations.schema_migrations` eingetragen, wie bei
`20261005170000` und `20261005171000` oben. Wann `180100` und `180300` genau liefen, ist
nicht festgehalten. Ihre Platzhalter liegen nach den beiden `apply_migration`-Versionen
und bleiben deshalb als von Hand gewählte Versionen stehen. Die Mitbring-Löschung trug
den Platzhalter `20261009170000`, der vor alle anderen sortierte, obwohl sie als letzte
lief. Sie heißt jetzt nach der Uhrzeit der Datenbank kurz danach. Durch die Umbenennung
läuft die Spaltensperre von `events` beim erneuten Abspielen vor
`get_party_by_invite_code`, nicht mehr danach. Die Funktion ist SECURITY DEFINER und
liest `events` als Owner, die Spaltenrechte treffen sie also nicht.

`20261009173711` und `20261009180100` prüfen vorher per md5, dass der Funktionsrumpf auf
der Datenbank noch der vom 09.10.2026 ist, und brechen sonst ab. Getestet in
zurückgerollten Transaktionen auf der Live-Datenbank: 24-Stunden-Grenze für Gast, Host
und Fremden; Einladungscode als anon und als Fremder; Anlegen, Bearbeiten,
Link-Zurücksetzen, RSVP und Abstimmen mit den neuen Spaltenrechten. Warum es so gebaut
ist, steht in `SCHEMA.md`, Abschnitte 2, 4, 8 und 9a.

## Die Migrationen aus dem Final Review von Schritt 12

Geschrieben und angewendet am 12.10.2026. Zu jeder Datei liegt ein Rollback mit demselben
Namen in `supabase/rollbacks/`.

| Datei | Was sie ändert | Wie angewendet | Version |
|---|---|---|---|
| `20261012140000_drop_invite_opens_on_link_reset_and_removal.sql` | Trigger `events_drop_invite_opens` und `rsvps_drop_invite_open`: Link-Reset und Entfernen eines Gasts löschen seine `invite_opens`-Zeilen | SQL-Editor (der Rumpf enthält ein DELETE) | von Hand gewählt, per INSERT eingetragen |
| `20261012171505_add_get_party_invite_code.sql` | `get_party_invite_code`: der Host liest seinen Einladungscode, sonst niemand, anon gar nicht | `apply_migration` | echt, von `apply_migration` vergeben |
| `20261012173022_hide_the_invite_code_of_events.sql` | `events`: SELECT auf `invite_code` für `authenticated` entzogen | `apply_migration`, nach dem Merge (`13f47f4`), Deployment auf Ready | echt, von `apply_migration` vergeben; Platzhalter war `20261012180000` |
| `20261012171512_check_the_background_url_of_events.sql` | CHECK `events_background_url_check`: `background_url` ist null, ein Preset `/backgrounds/bg-N.jpg` oder eine Datei im Bucket `event-backgrounds` dieses Projekts | `apply_migration`, NOT VALID und VALIDATE | echt, von `apply_migration` vergeben |

Für Editor-Migrationen muss das INSERT in `supabase_migrations.schema_migrations` als
zweite, eigene Anweisung ausgeführt werden; die Migrationsdatei enthält es nicht.

Getestet vorher in einer zurückgerollten Transaktion auf der Live-Datenbank: Entfernen
nimmt nur dem Entfernten den Zugang, erneutes Öffnen des Links gibt ihn zurück,
Bearbeiten ohne neuen Code lässt `invite_opens` stehen, nach dem Link-Reset sieht ein
Fremder die Adresse nicht mehr, ein Gast mit Zusage schon. Nach dem Ausführen per md5
geprüft: die Funktionsrümpfe auf der Datenbank sind dieselben wie in der Datei. Warum es
so gebaut ist, steht in `SCHEMA.md`, Abschnitt zu `private.invite_opens`.

## Die Migrationen zu Schritt 13b (Melden und Blockieren)

Geschrieben und angewendet am 14.10.2026. Zu jeder Datei liegt ein Rollback mit demselben
Namen in `supabase/rollbacks/`. Zurückrollen in umgekehrter Reihenfolge: `233956`,
`201200`, `200600`, `200539`, `200517`.

| Datei | Was sie ändert | Wie angewendet | Version |
|---|---|---|---|
| `20261014200517_create_blocks.sql` | Tabelle `blocks` (RLS, SELECT und DELETE der eigenen Zeilen, kein INSERT, nichts für anon), `private.has_blocked`, `private.is_blocked_between`, `get_my_blocked_users` | `apply_migration` | echt, von `apply_migration` vergeben |
| `20261014200539_create_reports.sql` | Tabelle `reports` (RLS ohne Policy, keine Rechte für anon und authenticated), Trigger `reports_cap_per_day`, `submit_report` | `apply_migration` | echt, von `apply_migration` vergeben |
| `20261014200600_add_block_and_unblock.sql` | `block_user` (räumt Anfragen, Zusagen und `invite_opens` zwischen den beiden ab) und `unblock_user` | SQL-Editor (der Rumpf enthält DELETE) | von Hand gewählt, per INSERT eingetragen |
| `20261014201200_hide_blocked_people.sql` | `get_explore_parties`, `get_my_parties`, `get_party_detail`, `get_party_guest_list`, `get_party_poll_data` verstecken einseitig; `request_to_join`, `can_rsvp_to_event`, `private.has_party_access` sperren in beide Richtungen | `apply_migration` | echt, von `apply_migration` vergeben |
| `20261014233956_email_new_reports.sql` | pg_net, `private.email_new_report` und Trigger `reports_email_new`: jede neue Meldung ruft die Edge Function `report-email` auf, die Arthur über Resend eine Mail schickt | `apply_migration`, angewendet am 15.10.2026 | echt, von `apply_migration` vergeben; Platzhalter war `20261015000000` |

`apply_migration` hat die Kommentare der Dateien nicht mitbekommen, nur die Anweisungen.
`20261014201200` prüft vorher per md5, dass die acht Funktionsrümpfe noch die vom
14.10.2026 sind. Danach per md5 geprüft: alle Rümpfe auf der Datenbank, auch die von
`block_user` und `unblock_user`, sind dieselben wie in den Dateien, und der Rollback stellt
die acht alten Rümpfe Zeichen für Zeichen wieder her. Owner, SECURITY, `search_path` und
Rechte sind unverändert. `get_party_guests` ist übersprungen, die App ruft es nicht mehr
auf. Getestet in zurückgerollten Transaktionen auf der Live-Datenbank als Blockierender,
Blockierter und Fremder. Warum es so gebaut ist, steht in `SCHEMA.md`, Abschnitt 9c.

`20261014233956` gehört zur dritten Sitzung von 13b (15.10.2026). Dazu kommen zwei Dinge,
die keine Migration sind und beim Zurückrollen von Hand weg müssen: die Edge Function
`supabase/functions/report-email` (per MCP mit `verify_jwt = false` deployt) und das
Geheimnis, das im Vault als `report_email_secret` und in den Edge-Function-Secrets als
`REPORT_EMAIL_SECRET` liegt. Die beiden REVOKEs auf `net` wirken nicht (`supabase_admin`
vergibt die Rechte selbst), siehe SCHEMA.md 9c. Danach per md5 geprüft: der Rumpf von
`private.email_new_report` auf der Datenbank ist derselbe wie in der Datei. Getestet in
zurückgerollten Transaktionen (Tageslimit: 20 Zeilen, 20 Anfragen, die 21. abgelehnt;
fehlendes Vault-Geheimnis: Meldung trotzdem gespeichert) und live mit einem kurzlebigen
Testkonto: falsches Geheimnis ergibt 403 und keine Mail, ungültiger Resend-Key ergibt 502
und keine Mail, beide Male ist die Meldung gespeichert; mit richtigem Key genau eine Mail
mit dem geplanten Inhalt. Testzeilen und Testkonto danach gelöscht, 0 Zeilen übrig.
