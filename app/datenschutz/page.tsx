import LegalTextScreen, { type LegalSection } from '@/features/profile/LegalTextScreen'

// Diese Erklärung beschreibt, was der Code tatsächlich tut — nicht was ein Generator-
// Baukasten vermutet. Sie folgt der Gliederung, die Art. 13 DSGVO verlangt, und füllt
// jeden Punkt mit dem, was am 26.08.2026 im Quelltext, in der Live-Datenbank und in den
// Antworten der beteiligten Server nachgeprüft wurde.
//
// Belegstellen für jeden genannten Empfänger:
//
//   Supabase        lib/supabase/client.ts, lib/supabase/server.ts, proxy.ts, alle Services
//   Cloudflare      nirgends im Code — Supabase setzt es selbst vor seine API. Belegt über
//                   die Antwort-Header: server: cloudflare auf /rest/v1/ UND /storage/v1/
//   Vercel          Hosting — von Arthur am 26.08.2026 bestätigt, vorbereitet über lib/site.ts
//   Resend          Mailversand. Noch NICHT angeschlossen: bis zur Umstellung verschickt
//                   Supabase Auth die Mails selbst. Steht auf Arthurs ausdrückliche
//                   Entscheidung trotzdem schon hier, damit der Text beim Umstellen nicht
//                   nachgezogen werden muss — deshalb nennt Abschnitt 7 beide Wege in
//                   einem Satz, statt heute etwas Falsches zu behaupten. Betreiber ist
//                   Plus Five Five, Inc., San Francisco; DPF-zertifiziert nach eigener
//                   DPA, Abschnitt 11.1, zusätzlich Standardvertragsklauseln
//   Google Maps     features/parties/components/PartyMap.tsx (Static Maps API)
//   Google Sign-In  features/auth/services/auth.service.ts:15, features/auth/components/AuthSheet.tsx
//   Photon/komoot   features/parties/components/AddressSearchField.tsx:16
//
// Drei Messungen, die im Text auftauchen und deshalb hier festgehalten sind:
//
//   1. Serverstandort. db.<ref>.supabase.co löst auf 2a05:d014:128e:9500:… auf; AWS führt
//      2a05:d014::/35 in ip-ranges.json unter eu-central-1 — Frankfurt am Main. Die
//      API-Domain hilft nicht weiter, sie zeigt auf Cloudflare-IPs.
//   2. Die Kartenvorschau setzt kein Cookie. Ein HEAD auf die Static-Maps-URL mit unserem
//      Key antwortet mit 200, content-type: image/png und KEINEM Set-Cookie-Header. Das
//      ist der Grund, warum § 25 Abs. 1 TDDDG hier nicht greift und Art. 6 Abs. 1 lit. f
//      die tragende Grundlage ist: es wird nichts auf dem Gerät gespeichert oder gelesen.
//   3. Photon läuft auf 116.202.51.114 — laut RIPE Hetzner Online GmbH, Deutschland. Also
//      kein Drittland, obwohl die Anfrage das Gerät verlässt.
//
// Was hier bewusst NICHT mehr steht: die frühere Zusage, die Adresse eines hochgeladenen
// Bildes lasse sich „weder erraten noch auflisten". Der Pfad ist {user_id}/avatar-{ms}.jpg
// beziehungsweise {user_id}/{party_id}/background.jpg — er enthält keine zufällige
// Komponente. Ein Versprechen, das die Policies nicht halten, gehört nicht in eine
// Datenschutzerklärung. Der Text sagt deshalb nur das, was zutrifft: der Speicher ist
// öffentlich, wer die Adresse hat, kommt an das Bild.
//
// Zum Auflisten stand hier bis zum 27.08.2026, die SELECT-Policy beider Buckets sei
// `authenticated` ohne weitere Einschränkung — jeder angemeldete Account konnte also
// fremde Bilder auflisten. Das ist seit Migration 20260827100812 nicht mehr so: die
// Policies gelten nur noch für den eigenen Ordner. Am Satz im Text ändert das nichts,
// denn die Buckets bleiben öffentlich; geschlossen ist das Auflisten, nicht die URL.
//
// Nachtrag 27.08.2026: Der Satz in Abschnitt 6, nach dem die Anschrift nach der Party
// nicht mehr im Link steht, wird seither auch vom Server gehalten, nicht nur von der
// Oberfläche — get_party_by_invite_code liefert location dann leer aus (Migration
// 20260827113025). Ausgenommen ist der Gastgeber, der seine eigene vergangene Party
// weiterhin vollständig sieht.
//
// Kein Analytics, kein Tracking, keine Werbe-Cookies — im ganzen Projekt kein einziger
// Treffer. Deshalb braucht die App auch kein Cookie-Banner: die einzigen Cookies sind die
// Auth-Cookies von Supabase, und die sind technisch notwendig (§ 25 Abs. 2 Nr. 2 TDDDG).
const SECTIONS: LegalSection[] = [
  {
    paragraphs: [
      'Diese Erklärung sagt dir, welche Daten areuout über dich verarbeitet, warum, wer sie zu sehen bekommt und was du dagegen tun kannst.',
      'Sie beschreibt die App, nicht den Standardtext eines Generators: Jeder hier genannte Dienst steht auch wirklich im Quelltext — und jeder, der dort steht, ist hier genannt.',
    ],
  },
  {
    heading: '1. Das Wichtigste in Kürze',
    paragraphs: [
      'areuout ist ein privates Projekt, kein Unternehmen. Es gibt keine Werbung, kein Tracking, keine Auswertung deines Verhaltens und keinen Verkauf von Daten.',
      'Gespeichert wird, was die App braucht: dein Konto, deinen Namen, deine Partys und deine Antworten auf Einladungen. Kein Geburtsdatum, kein Alter, kein Geschlecht, keine Telefonnummer, keine Wohnanschrift, kein Gerätestandort.',
      'Die Datenbank steht in Frankfurt am Main. Nach außen gehen Daten nur an die wenigen Dienstleister, die in Abschnitt 7 einzeln aufgezählt sind.',
      'Du kannst dein Konto jederzeit in der App löschen. Deine Daten verschwinden dann sofort und vollständig, nicht erst nach einer Frist.',
      'Die App setzt nur ein technisch notwendiges Cookie — das, mit dem du angemeldet bleibst. Deshalb fragt dich auch kein Banner um Erlaubnis.',
    ],
  },
  {
    heading: '2. Wer verantwortlich ist',
    paragraphs: [
      'Arthur Kunz, Bretschneiderstraße 14, 04229 Leipzig, Deutschland.',
      'E-Mail: azzuro.kunz@gmail.com. Telefon: +49 173 3530620.',
      'Verantwortlicher im Sinne von Art. 4 Nr. 7 DSGVO ist, wer über Zwecke und Mittel der Verarbeitung entscheidet. Das ist hier eine Privatperson, kein Unternehmen — an der Verantwortung ändert das nichts.',
      'Ein Datenschutzbeauftragter ist nicht bestellt. Die Voraussetzungen nach Art. 37 DSGVO und § 38 BDSG liegen nicht vor: Die App wird nicht von zwanzig Personen betrieben, verarbeitet keine besonderen Datenkategorien und überwacht niemanden systematisch.',
    ],
  },
  {
    heading: '3. Mindestalter',
    paragraphs: [
      'areuout richtet sich an Menschen ab 16 Jahren. Mit der Anmeldung bestätigst du, dass du mindestens 16 Jahre alt bist.',
      'Wir speichern bewusst kein Geburtsdatum und kein Alter. Die Altersgrenze steht in den Nutzungsbedingungen, nicht in einem Datenfeld — so wird für die Alterskontrolle kein zusätzliches Datum erhoben. Das bedeutet zugleich: Wir können dein Alter nicht selbst prüfen und verlassen uns auf deine Angabe.',
      'Erfahren wir, dass ein Konto einer jüngeren Person gehört, löschen wir es.',
    ],
  },
  {
    heading: '4. Welche Daten verarbeitet werden',
    paragraphs: [
      'Konto: deine E-Mail-Adresse, dein Passwort, der Zeitpunkt der Anmeldung und der letzten Anmeldung sowie die Information, ob deine E-Mail-Adresse bestätigt ist und ob du dich per E-Mail oder über Google anmeldest. Das Passwort wird ausschließlich als kryptografischer Hash gespeichert, niemals im Klartext — auch wir können es nicht lesen.',
      'Profil: Vorname, Nachname, eine Avatar-Farbe und, wenn du eines hochlädst, ein Profilbild.',
      'Partys, die du erstellst: Titel, Beschreibung, Datum, Uhrzeit, optionale Endzeit, Adresse, optionale maximale Gästezahl, ein Hintergrundbild — entweder eines der vorgegebenen Motive oder ein eigenes Foto — sowie ein zufällig erzeugter Einladungscode und der Erstellzeitpunkt.',
      'Teilnahme: deine Antwort auf eine Einladung — zugesagt, vielleicht oder abgesagt — und der Zeitpunkt, zu dem du sie gegeben hast.',
      'Umfragen: die Fragen und Antwortmöglichkeiten, die ein Gastgeber stellt, und deine Auswahl beziehungsweise dein Freitext dazu.',
      'Technische Verbindungsdaten: Beim Aufruf der App und bei jeder Datenbankabfrage fallen bei unseren Dienstleistern IP-Adresse, Browser- und Gerätekennung, Zeitpunkt, Herkunftsland und die aufgerufene Adresse an. Die App selbst greift auf keine dieser Angaben zu und speichert sie nirgends in ihrer eigenen Datenbank.',
      'Bilder: Aus jedem Bild, das du hochlädst, werden vor dem Speichern die Kameradaten entfernt. Das betrifft insbesondere GPS-Koordinaten, Gerätemodell und Aufnahmezeitpunkt, die Handykameras in ihre Fotos schreiben. Gespeichert wird nur eine verkleinerte Fassung ohne diese Angaben.',
      'Nicht erhoben werden: Geburtsdatum, Alter, Geschlecht, Telefonnummer, deine eigene Wohnanschrift und der Standort deines Geräts. Die App fragt nichts davon ab und hat für nichts davon ein Feld.',
    ],
  },
  {
    heading: '5. Wozu, und auf welcher Rechtsgrundlage',
    paragraphs: [
      'Konto, Profil, Partys, Einladungen, Zusagen und Umfragen verarbeiten wir, um dir die App bereitzustellen — Art. 6 Abs. 1 lit. b DSGVO, Erfüllung des Nutzungsvertrags. Ohne diese Daten gibt es kein Konto und keine Party. Du bist zu keiner Angabe gesetzlich verpflichtet; ohne sie lässt sich die App aber nicht nutzen.',
      'Meldest du dich über Google an, beruht auch das auf Art. 6 Abs. 1 lit. b DSGVO: Ohne eine E-Mail-Adresse, die dein Konto identifiziert, kommt kein Nutzungsvertrag zustande. Welchen der beiden Wege du nimmst, entscheidest du — wählst du E-Mail und Passwort, findet die Verarbeitung über Google nicht statt.',
      'Ein Profil- oder Hintergrundbild hochzuladen ist freiwillig und beruht auf deiner Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO. Du kannst sie jederzeit widerrufen, indem du das Bild entfernst; die Verarbeitung bis dahin bleibt rechtmäßig.',
      'E-Mails, die die App dir schickt — der Bestätigungscode bei der Anmeldung, das Zurücksetzen des Passworts und Hinweise zu Partys, zu denen du gehörst —, sind Teil dieser Bereitstellung und beruhen ebenfalls auf Art. 6 Abs. 1 lit. b DSGVO. Werbe-E-Mails verschicken wir nicht.',
      'Die Kartenvorschau auf der Party-Seite und die Adresssuche beim Erstellen einer Party beruhen auf unserem berechtigten Interesse nach Art. 6 Abs. 1 lit. f DSGVO. Das Interesse ist, dass eine Einladung zeigt, wo die Party stattfindet, und dass ein Gastgeber die Adresse auswählen kann, statt sie fehlerfrei abtippen zu müssen. Beides ließe sich ohne diese Dienste nicht sinnvoll bauen.',
      'Den technisch sicheren Betrieb — Server-Protokolle, Abwehr von Missbrauch, Verfügbarkeit — stützen wir ebenfalls auf Art. 6 Abs. 1 lit. f DSGVO.',
      'Müssen wir gesetzlichen Pflichten nachkommen, etwa einer Auskunft gegenüber einer Behörde, ist die Grundlage Art. 6 Abs. 1 lit. c DSGVO.',
    ],
  },
  {
    heading: '6. Wer deine Daten in der App sieht',
    paragraphs: [
      'Gäste derselben Party sehen deinen Vornamen, deinen Nachnamen, dein Profilbild beziehungsweise deine Initialen und deine Antwort auf die Einladung. Wer eine Umfrage beantwortet, dessen Antwort sehen die übrigen Gäste derselben Party und der Gastgeber.',
      'Der Gastgeber sieht dieselben Angaben und kann dich von seiner Gästeliste entfernen.',
      'Dein Profil selbst ist nicht öffentlich. Andere kommen an deinen Namen nur über eine Abfrage, die auf die Gästeliste einer konkreten Party beschränkt ist.',
      'Wer den Einladungslink einer Party hat, sieht auch ohne Konto ihren Titel, ihre Beschreibung, das Datum, das Hintergrundbild und die Adresse. Die Gästeliste und die Umfragen zeigt die App nur angemeldeten Gästen. Der Link ist das einzige Geheimnis, das diese Angaben schützt — gib ihn nur an Menschen weiter, die eingeladen sein sollen.',
      'Ist eine Party vorbei, blendet die App die Adresse aus. Der Link bleibt gültig, die Anschrift steht dann aber nicht mehr darin.',
      'Wird ein Einladungslink in einem Chat geteilt, erzeugt der Messenger daraus eine Vorschau und lädt dafür Titel, Beschreibung und Hintergrundbild von unserem Server. Die Adresse steht bewusst nicht in dieser Vorschau, weil sie sonst in fremden Chatverläufen und auf gesperrten Bildschirmen auftauchen würde.',
      'Profilbilder und Party-Hintergründe liegen in einem öffentlichen Dateispeicher. Wer die Adresse einer solchen Datei kennt, kann das Bild auch ohne Konto abrufen, solange es dort liegt. Lädst du ein neues Bild hoch oder wechselst du zurück zu den Initialen, wird das alte gelöscht und seine Adresse ungültig.',
      'Deine E-Mail-Adresse sehen andere Nutzerinnen und Nutzer nicht.',
      'Es findet kein Verkauf statt und keine Weitergabe zu Werbezwecken. Außerhalb der App bekommen deine Daten nur die Dienstleister aus dem nächsten Abschnitt zu sehen, und die nur, soweit sie sie für ihre Aufgabe brauchen.',
    ],
  },
  {
    heading: '7. Dienstleister und externe Dienste',
    paragraphs: [
      'Supabase (Supabase Inc., USA) betreibt Datenbank, Nutzerkonten und Dateispeicher. Die Server stehen in Frankfurt am Main, AWS-Region eu-central-1, also in der EU — nachgemessen, nicht abgeschrieben. Bei jeder Abfrage protokolliert Supabase technische Angaben, darunter IP-Adresse, Herkunftsland, Browserkennung und die aufgerufene Adresse. Mit Supabase besteht ein Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO.',
      'Cloudflare (Cloudflare, Inc., USA) liegt technisch vor der Datenbank und dem Bildspeicher von Supabase und sichert die Verbindung ab. Jede Abfrage und jeder Bildabruf läuft darüber, wobei deine IP-Adresse verarbeitet wird. Die Verarbeitung erfolgt in einem weltweiten Netz, in der Regel am nächstgelegenen Standort. Wir sind bei Cloudflare nicht selbst Kunde: Der Dienst ist Supabase vorgeschaltet und über deren Vertrag als Unterauftragsverarbeiter nach Art. 28 Abs. 2 und 4 DSGVO eingebunden.',
      'Vercel (Vercel Inc., USA) hostet die Anwendung. Beim Aufruf entstehen technisch notwendige Server-Protokolle, darunter IP-Adresse, Zeitpunkt und aufgerufene Adresse. Auch mit Vercel besteht ein Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO.',
      'Resend (Plus Five Five, Inc., 2261 Market Street #5039, San Francisco, CA 94114, USA) verschickt die E-Mails der App: den Bestätigungscode bei der Anmeldung, die Nachricht zum Zurücksetzen des Passworts und Hinweise zu deinen Partys. Übertragen werden dabei deine E-Mail-Adresse und der Inhalt der jeweiligen Nachricht; die Verarbeitung findet in den USA statt. Bis zur Umstellung auf Resend übernimmt diesen Versand der Standarddienst von Supabase. Mit Resend besteht ein Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO.',
      'Google Maps (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland): Auf der Party-Seite wird eine Kartenvorschau geladen. Dabei gehen die Adresse der Party und deine IP-Adresse an Google — automatisch beim Öffnen der Seite, auch wenn du die Karte nicht antippst, und auch dann, wenn du kein Konto hast. Die Vorschau ist ein einzelnes Bild: Sie setzt kein Cookie und speichert nichts auf deinem Gerät. Tippst du sie an, öffnet sich Google Maps als eigene Seite; dann gelten die Bestimmungen von Google.',
      'Google Sign-In (Google Ireland Limited): nur, wenn du dich für die Anmeldung mit Google entscheidest. Wir erhalten dabei deine E-Mail-Adresse und eine Kennung deines Google-Kontos; Google erfährt, dass du dich bei areuout anmeldest. Wählst du diesen Weg nicht, wird nichts an Google übertragen.',
      'Photon (komoot GmbH, Potsdam): Die Adresssuche beim Erstellen einer Party schickt deine Eingabe an Photon — ab drei Zeichen und sobald du beim Tippen kurz innehältst, also nicht erst beim Absenden. Übertragen werden der eingegebene Adressanfang und deine IP-Adresse. Kürzere Eingaben verlassen dein Gerät nicht. Die Server stehen in Deutschland.',
      'Google und komoot sind an dieser Stelle keine Auftragsverarbeiter: Bei der Kartenvorschau, der Anmeldung mit Google und der Adresssuche entscheiden sie selbst über die Verarbeitung und sind dafür eigenständig verantwortlich. Ein Vertrag nach Art. 28 DSGVO besteht mit ihnen deshalb nicht — sie handeln nicht auf unsere Weisung, sondern nach ihren eigenen Bestimmungen.',
      'Analyse-, Werbe- oder Fehlerüberwachungsdienste setzen wir nicht ein. Auch die Schriftarten der App liegen auf unserem eigenen Server: Beim Laden einer Seite geht deshalb keine Anfrage an einen Schriften-Server von Google.',
    ],
  },
  {
    heading: '8. Übermittlung in Länder außerhalb der EU',
    paragraphs: [
      'Die Daten, die die App selbst speichert, liegen in der EU. Bei Cloudflare, Vercel und Google lässt sich eine Verarbeitung in den USA nicht ausschließen, beim Mailversand über Resend findet sie dort statt. Supabase ist ein US-Unternehmen, auch wenn seine Server für dieses Projekt in Frankfurt stehen.',
      'Google, Cloudflare und Resend sind nach dem EU-US Data Privacy Framework zertifiziert. Für sie stützt sich die Übermittlung auf den Angemessenheitsbeschluss der EU-Kommission vom 10. Juli 2023 und ergänzend auf die Standardvertragsklauseln der EU-Kommission.',
      'Bei Supabase und Vercel stützt sie sich auf die Standardvertragsklauseln der EU-Kommission, die Bestandteil der jeweiligen Verträge zur Auftragsverarbeitung sind.',
      'Eine Kopie der vereinbarten Garantien kannst du unter der oben genannten Adresse anfordern.',
    ],
  },
  {
    heading: '9. Cookies und Speicherung auf deinem Gerät',
    paragraphs: [
      'areuout setzt ausschließlich technisch notwendige Cookies, und es gibt nur eine Sorte davon: das Anmelde-Token, mit dem dein Gerät angemeldet bleibt. Es wird von Supabase gesetzt, kann aus technischen Gründen auf mehrere Teil-Cookies aufgeteilt sein, hat eine Laufzeit von bis zu 400 Tagen und verschwindet, wenn du dich abmeldest.',
      'Besuchst du nur eine Einladungsseite, ohne dich anzumelden, setzt die App überhaupt kein Cookie.',
      'Weitere Speicher deines Browsers — localStorage oder sessionStorage — nutzt die App nicht.',
      'Es gibt keine Analyse-, Tracking- oder Werbe-Cookies. Deshalb fragt die App auch nicht nach einer Cookie-Einwilligung: Für technisch notwendige Cookies ist nach § 25 Abs. 2 Nr. 2 TDDDG keine erforderlich.',
    ],
  },
  {
    heading: '10. Server-Protokolle',
    paragraphs: [
      'Wie jeder Webserver protokollieren die Server unserer Dienstleister automatisch Angaben, die dein Browser mitschickt: Browsertyp und -version, Betriebssystem, Herkunftsseite, Hostname, Uhrzeit der Anfrage und IP-Adresse.',
      'Diese Daten werden nicht mit anderen Quellen zusammengeführt und nicht dazu verwendet, dich wiederzuerkennen. Grundlage ist Art. 6 Abs. 1 lit. f DSGVO: Ein Dienst, der nicht protokolliert, lässt sich weder betreiben noch absichern.',
      'Die Protokolle löschen die Anbieter nach ihren eigenen Fristen. Wir nutzen bei allen die kostenlosen Tarife, in denen die kürzesten Aufbewahrungszeiten gelten.',
    ],
  },
  {
    heading: '11. Wie lange wir speichern, und wie du löschst',
    paragraphs: [
      'Deine Daten bleiben gespeichert, solange dein Konto besteht. Eine darüber hinausgehende Frist gibt es nicht: Wir sind kein Unternehmen und unterliegen keinen steuer- oder handelsrechtlichen Aufbewahrungspflichten.',
      'Löschst du dein Konto unter „Profil → Account", werden dein Profil, deine Partys, deine Zu- und Absagen, deine Umfrageantworten und deine hochgeladenen Bilder unwiderruflich entfernt — auch die Antworten, die du bei Partys anderer gegeben hast. Das geschieht sofort und vollständig, nicht als Markierung zum späteren Löschen. Automatische Sicherungskopien der Datenbank gibt es in unserem Tarif nicht, aus denen etwas zurückkehren könnte.',
      'Löschst du eine einzelne Party, verschwinden damit auch die Zusagen, Umfragen und Antworten zu dieser Party sowie ihr Hintergrundbild.',
      'Für die Protokolle der Dienstleister gilt Abschnitt 10.',
    ],
  },
  {
    heading: '12. Deine Rechte',
    paragraphs: [
      'Du hast das Recht auf Auskunft über die zu dir gespeicherten Daten (Art. 15 DSGVO), auf Berichtigung (Art. 16), auf Löschung (Art. 17), auf Einschränkung der Verarbeitung (Art. 18), auf Datenübertragbarkeit (Art. 20) und auf Widerspruch (Art. 21, siehe den nächsten Abschnitt).',
      'Eine erteilte Einwilligung — etwa für ein hochgeladenes Bild — kannst du jederzeit mit Wirkung für die Zukunft widerrufen. Das Bild zu entfernen genügt dafür.',
      'Für Auskunft und Löschung genügt in der Regel die App selbst: Dein Profil zeigt die gespeicherten Angaben, und „Account löschen" entfernt alles. Für alles Weitere schreib uns an die in Abschnitt 2 genannte Adresse; wir antworten innerhalb der gesetzlichen Frist von einem Monat.',
      'Du kannst dich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren — bei der für Leipzig zuständigen sächsischen Aufsichtsbehörde oder bei der Behörde deines Wohnorts oder Arbeitsplatzes. Dieses Recht besteht unabhängig von jedem anderen Rechtsbehelf.',
    ],
  },
  {
    heading: '13. Widerspruchsrecht nach Art. 21 DSGVO',
    paragraphs: [
      'Soweit wir Daten auf Grundlage eines berechtigten Interesses nach Art. 6 Abs. 1 lit. f DSGVO verarbeiten — das betrifft die Kartenvorschau, die Adresssuche und die Server-Protokolle —, hast du das Recht, aus Gründen, die sich aus deiner besonderen Situation ergeben, jederzeit Widerspruch gegen diese Verarbeitung einzulegen.',
      'Legst du Widerspruch ein, verarbeiten wir die betroffenen Daten nicht mehr, es sei denn, wir können zwingende schutzwürdige Gründe nachweisen, die deine Interessen, Rechte und Freiheiten überwiegen, oder die Verarbeitung dient der Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen.',
      'Ein Widerspruch genügt formlos an die in Abschnitt 2 genannte Adresse.',
      'Direktwerbung betreiben wir nicht, weder per E-Mail noch in der App. Ein Widerspruch dagegen geht deshalb ins Leere — es gibt nichts, dem zu widersprechen wäre.',
    ],
  },
  {
    heading: '14. Keine automatisierten Entscheidungen',
    paragraphs: [
      'Es findet keine automatisierte Entscheidungsfindung im Sinne von Art. 22 DSGVO statt und kein Profiling. Die App bewertet dich nicht, erstellt kein Punktesystem und trifft keine Entscheidungen über dich.',
      'Es gibt auch keine Empfehlungen, die aus deinem Verhalten berechnet werden: Du siehst die Partys, zu denen du eingeladen bist, und sonst keine.',
    ],
  },
  {
    heading: '15. Datensicherheit',
    paragraphs: [
      'Die Verbindung zur App ist durchgehend mit TLS verschlüsselt. Eine verschlüsselte Verbindung erkennst du am https:// in der Adresszeile und am Schloss-Symbol deines Browsers.',
      'Der Zugriff auf die Datenbank ist zeilenweise abgesichert: Jede Abfrage wird auf dem Server daraufhin geprüft, ob das anfragende Konto die betreffende Zeile überhaupt sehen darf. Das gilt auch dann, wenn jemand die App umgeht und direkt mit der Datenbank spricht.',
      'Passwörter werden nur als Hash gespeichert, hochgeladene Bilder vor dem Speichern von ihren Kameradaten befreit.',
      'Einen absoluten Schutz vor unbefugtem Zugriff gibt es technisch nicht. Auch die Datenübertragung im Internet — etwa per E-Mail — kann Sicherheitslücken aufweisen.',
    ],
  },
  {
    heading: '16. Werbe-E-Mails an uns',
    paragraphs: [
      'Der Nutzung der im Impressum veröffentlichten Kontaktdaten zur Übersendung nicht ausdrücklich angeforderter Werbung wird hiermit widersprochen.',
    ],
  },
  {
    heading: '17. Änderungen dieser Erklärung',
    paragraphs: [
      'Wir passen diese Erklärung an, wenn sich die App oder die Rechtslage ändert. Es gilt die jeweils hier veröffentlichte Fassung; das Datum oben zeigt den Stand.',
      'Ändert sich etwas Wesentliches — ein neuer Dienstleister, ein neuer Zweck —, weisen wir in der App darauf hin, bevor es wirksam wird.',
    ],
  },
]

export default function DatenschutzPage() {
  return <LegalTextScreen title='Datenschutz' sections={SECTIONS} updated='26. August 2026' />
}
