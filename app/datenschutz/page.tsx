import LegalTextScreen, { type LegalSection } from '@/features/profile/LegalTextScreen'

// Diese Erklärung beschreibt, was der Code tatsächlich tut — nicht was ein
// Generator-Baukasten vermutet. Jeder genannte Empfänger steht auch wirklich im
// Quelltext:
//
//   Supabase       lib/supabase/client.ts, proxy.ts, sämtliche Services
//   Cloudflare     nirgends im Code — Supabase setzt es selbst vor seine API. Belegt
//                  über die Antwort-Header: server: cloudflare auf /rest/v1/ UND
//                  /storage/v1/. Genau deshalb fehlte es in der ersten Fassung
//   Vercel         Hosting
//   Google Maps    features/parties/components/PartyMap.tsx (Static Maps API)
//   Photon/komoot  features/parties/components/AddressSearchField.tsx
//   Google Sign-In features/auth/services/auth.service.ts
//
// Kein Analytics, kein Tracking, keine Werbe-Cookies — geprüft, es gibt im ganzen
// Projekt keinen einzigen Treffer dafür. Deshalb braucht die App auch kein
// Cookie-Banner: die einzigen Cookies sind die Auth-Cookies von Supabase, und die
// sind technisch notwendig (§ 25 Abs. 2 Nr. 2 TDDDG).
//
// Zwei Stellen sind mit «...» markiert und müssen von Arthur gefüllt werden:
// Anschrift/E-Mail (wie im Impressum) und die Region des Supabase-Projekts, die im
// Supabase-Dashboard unter Settings → General steht.
const SECTIONS: LegalSection[] = [
  {
    paragraphs: [
      'Diese Erklärung beschreibt, welche personenbezogenen Daten Student Connect verarbeitet, warum, und welche Rechte du hast.',
    ],
  },
  {
    heading: '1. Verantwortlicher',
    paragraphs: [
      'Arthur Kunz, «Straße und Hausnummer», «PLZ und Ort», Deutschland. E-Mail: «kontakt@deine-domain.de».',
      'Ein Datenschutzbeauftragter ist nicht bestellt; die gesetzlichen Voraussetzungen dafür liegen nicht vor.',
    ],
  },
  {
    heading: '2. Mindestalter',
    paragraphs: [
      'Student Connect richtet sich an Menschen ab 16 Jahren. Mit der Anmeldung bestätigst du, dass du mindestens 16 Jahre alt bist.',
      'Wir speichern bewusst kein Geburtsdatum und kein Alter. Die Altersgrenze steht in den Nutzungsbedingungen, nicht in einem Datenfeld — so wird für die Alterskontrolle kein zusätzliches Datum erhoben.',
    ],
  },
  {
    heading: '3. Welche Daten wir verarbeiten',
    paragraphs: [
      'Konto: deine E-Mail-Adresse und dein Passwort. Das Passwort wird ausschließlich als kryptografischer Hash gespeichert, niemals im Klartext. Meldest du dich mit Google an, erhalten wir von Google deine E-Mail-Adresse.',
      'Profil: Vorname, Nachname, eine Avatar-Farbe und, wenn du eines hochlädst, ein Profilbild.',
      'Partys, die du erstellst: Titel, Beschreibung, Datum, Uhrzeit, optionale Endzeit, Adresse, optionale maximale Gästezahl, ein optionales Hintergrundbild sowie ein zufällig erzeugter Einladungscode.',
      'Teilnahme: deine Zu- oder Absage zu einer Party und deine Antworten auf Umfragen des Gastgebers.',
      'Wir erheben kein Geburtsdatum, kein Geschlecht, keine Telefonnummer und keine Standortdaten deines Geräts.',
    ],
  },
  {
    heading: '4. Rechtsgrundlage',
    paragraphs: [
      'Die Verarbeitung erfolgt zur Erfüllung des Nutzungsvertrags nach Art. 6 Abs. 1 lit. b DSGVO. Ohne diese Daten kann die App ihren Zweck — Partys erstellen, Einladungen teilen, zu- oder absagen — nicht erfüllen.',
      'Das Hochladen eines Profil- oder Hintergrundbildes ist freiwillig und beruht auf deiner Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO. Du kannst sie jederzeit widerrufen, indem du das Bild entfernst.',
    ],
  },
  {
    heading: '5. Wer deine Daten sieht',
    paragraphs: [
      'Andere Gäste einer Party sehen deinen Vornamen, deinen Nachnamen, dein Profilbild beziehungsweise deine Initialen und deine Antwort auf die Einladung. Wer eine Umfrage beantwortet, dessen Antwort sehen die übrigen Gäste derselben Party.',
      'Wer den Einladungslink einer Party besitzt, sieht deren Titel, Datum, Adresse und die Gästeliste. Der Link ist der einzige Schutz dieser Angaben — teile ihn nur mit Menschen, die eingeladen sein sollen.',
      'Deine E-Mail-Adresse sehen andere Nutzerinnen und Nutzer nicht.',
      'Hochgeladene Profilbilder und Party-Hintergründe liegen unter einer zufällig erzeugten Adresse. Diese Adresse lässt sich weder erraten noch auflisten — wer sie aber kennt, kann das Bild auch ohne Anmeldung abrufen, solange es existiert. Lädst du ein neues Bild hoch oder wechselst du zu den Initialen, wird das alte gelöscht und die Adresse ungültig.',
      'Aus jedem hochgeladenen Bild entfernen wir vor dem Speichern die Kameradaten. Das betrifft insbesondere GPS-Koordinaten, Gerätemodell und Aufnahmezeitpunkt, die Handykameras in ihre Fotos schreiben. Gespeichert wird nur eine verkleinerte Fassung ohne diese Angaben.',
      'Es findet kein Verkauf und keine Weitergabe zu Werbezwecken statt.',
    ],
  },
  {
    heading: '6. Auftragsverarbeiter und externe Dienste',
    paragraphs: [
      'Supabase: Datenbank, Nutzerkonten und Speicherung der hochgeladenen Bilder. Serverstandort: «Region des Supabase-Projekts eintragen». Mit Supabase besteht ein Auftragsverarbeitungsvertrag.',
      'Cloudflare: Liegt technisch vor der Datenbank und dem Bildspeicher von Supabase und sichert die Verbindung ab. Jede Abfrage und jeder Bildabruf läuft darüber, wobei deine IP-Adresse verarbeitet wird. Anbieter ist Cloudflare, Inc. mit Sitz in den USA; die Verarbeitung erfolgt in einem weltweiten Netz, in der Regel am nächstgelegenen Standort.',
      'Vercel: Hosting der Anwendung. Beim Aufruf werden technisch notwendige Server-Logs verarbeitet, darunter IP-Adresse, Zeitpunkt und aufgerufene Adresse.',
      'Google Maps (Static Maps API): Auf der Detailseite einer Party wird eine Kartenvorschau geladen. Dabei werden die Adresse der Party und deine IP-Adresse an Google übertragen — auch dann, wenn du die Karte nicht antippst. Anbieter ist Google Ireland Limited.',
      'Photon (komoot GmbH): Die Adresssuche beim Erstellen einer Party schickt deine Eingabe an Photon — sobald du beim Tippen kurz innehältst und mindestens drei Zeichen eingegeben hast, also nicht erst beim Absenden. Übertragen wird der eingegebene Adressanfang zusammen mit deiner IP-Adresse. Kürzere Eingaben verlassen dein Gerät nicht.',
      'Google Sign-In: Nur wenn du dich für die Anmeldung mit Google entscheidest. Dabei gelten zusätzlich die Datenschutzbestimmungen von Google.',
      'Bei Google kann eine Übermittlung in die USA nicht ausgeschlossen werden. Google ist unter dem EU-US Data Privacy Framework zertifiziert; die Übermittlung stützt sich auf den Angemessenheitsbeschluss der EU-Kommission sowie ergänzend auf Standardvertragsklauseln.',
    ],
  },
  {
    heading: '7. Cookies',
    paragraphs: [
      'Student Connect setzt ausschließlich technisch notwendige Cookies. Sie enthalten das Anmelde-Token, mit dem dein Gerät angemeldet bleibt, und werden von Supabase gesetzt.',
      'Es gibt keine Analyse-, Tracking- oder Werbe-Cookies und keine Einbindung von Analysediensten. Deshalb fragt die App auch nicht nach einer Cookie-Einwilligung — für technisch notwendige Cookies ist nach § 25 Abs. 2 Nr. 2 TDDDG keine erforderlich.',
    ],
  },
  {
    heading: '8. Speicherdauer',
    paragraphs: [
      'Deine Daten bleiben gespeichert, solange dein Konto besteht.',
      'Löschst du dein Konto unter „Profil → Account", werden dein Profil, deine Partys, deine Zu- und Absagen, deine Umfrageantworten und deine hochgeladenen Bilder unwiderruflich entfernt. Das geschieht sofort und vollständig, nicht als Markierung zum späteren Löschen.',
      'Löschst du eine Party, verschwinden damit auch die Zusagen, Umfragen und Antworten zu dieser Party sowie ihr Hintergrundbild.',
      'Server-Logs des Hosters werden nach dessen üblichen Fristen gelöscht.',
    ],
  },
  {
    heading: '9. Deine Rechte',
    paragraphs: [
      'Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21). Eine erteilte Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen.',
      'Für Auskunft und Löschung genügt in der Regel die App selbst: dein Profil zeigt die gespeicherten Angaben, und „Account löschen" entfernt alles. Für alles Weitere schreib uns an die oben genannte Adresse.',
      'Du kannst dich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren, etwa bei der für deinen Wohnsitz zuständigen Landesbeauftragten für Datenschutz.',
    ],
  },
  {
    heading: '10. Datensicherheit',
    paragraphs: [
      'Die Verbindung zur App ist durchgehend mit TLS verschlüsselt. Der Zugriff auf die Datenbank ist zeilenweise abgesichert: Jede Abfrage wird serverseitig darauf geprüft, ob der anfragende Account die betreffende Zeile überhaupt sehen darf.',
      'Ein absoluter Schutz vor unbefugtem Zugriff ist technisch nicht möglich.',
    ],
  },
  {
    heading: '11. Änderungen',
    paragraphs: [
      'Wir passen diese Erklärung an, wenn sich die App oder die Rechtslage ändert. Es gilt die jeweils hier veröffentlichte Fassung; das Datum oben zeigt den Stand.',
    ],
  },
]

export default function DatenschutzPage() {
  return <LegalTextScreen title='Datenschutz' sections={SECTIONS} updated='21. August 2026' />
}
