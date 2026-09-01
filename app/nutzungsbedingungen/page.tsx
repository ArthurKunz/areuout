import LegalTextScreen, { type LegalSection } from '@/features/profile/LegalTextScreen'

// Am 26.08.2026 gegen den Code neu geschrieben — so, wie die Datenschutzerklärung zwei
// Tage zuvor. Die Fassung vom 21.08. hatte zwölf Abschnitte und war an drei Stellen
// überholt, an einer schlicht falsch.
//
// Der Text, auf den sich die gesamte Datensparsamkeit der App stützt: Die Begründung
// dafür, dass kein Geburtsdatum gespeichert wird, lautet "The 16+ minimum lives in the
// terms" — § 3 ist die Stelle, die das trägt. Verschwindet dieser Absatz, muss die
// Entscheidung gegen das Geburtsdatum neu bewertet werden. Dieselbe Regel steht als
// harte Regel in CLAUDE.md.
//
// Belegstellen für alles, was hier über die App behauptet wird:
//
//   Einladungslink        get_party_by_invite_code ist für anon freigegeben,
//                         get_event_attendees_by_invite_code NICHT — ohne Konto also
//                         keine Gästeliste. InviteScreen.tsx:99 legt zusätzlich die
//                         Auth-Sperre über die ganze Seite
//   Antwortzwang          InviteScreen.tsx:117 — ein angemeldeter Gast ohne Antwort
//                         sieht die Party erst, nachdem er geantwortet hat
//   Party vorbei          isPartyOver in lib/utils.ts:65; InviteScreen und
//                         PartyDetailScreen blenden dann Adresse und RSVP-Zeile aus
//   Chat-Vorschau         app/e/[invite_code]/page.tsx:41 — bewusst OHNE Adresse
//   Gästezahl             events.max_guests, RLS-Policy party_has_room plus Trigger
//                         rsvps_enforce_capacity, Ablehnung mit "Diese Party ist voll."
//   Gast entfernen        PartyGuestsScreen.tsx:64 — der Link funktioniert danach weiter
//   Umfrageantworten      pool_responses: Mitglieder derselben Party lesen ALLE Antworten,
//                         auch die Freitexte
//   Bildbearbeitung       lib/image.ts — EXIF raus, verkleinert, als JPEG neu kodiert
//   Öffentlicher Speicher Buckets avatars und event-backgrounds, Pfade ohne zufällige
//                         Komponente ({user_id}/avatar-{ms}.jpg)
//   Kontolöschung         delete_self() plus ON DELETE CASCADE über alle sechs Tabellen;
//                         im Free-Tarif gibt es keine automatischen Backups
//   Anmeldung             8 Zeichen, Großbuchstabe, Zahl, Sonderzeichen
//                         (usePasswordValidation.ts), Bestätigungscode per E-Mail,
//                         wahlweise Google. Eine Möglichkeit, die E-Mail-Adresse in der
//                         App zu ändern, gibt es nicht — es gibt keinen Screen dafür
//   Hintergrundmotive     public/backgrounds/bg-1..8.jpg, ausgewählt statt hochgeladen
//                         (CreatePartyScreen.tsx:40)
//
// Was der Text bewusst NICHT sagt:
//
//   - Er verspricht nirgends, dass hochgeladene Bilder nur von Berechtigten abgerufen
//     werden können. Seit dem 27.08.2026 kann zwar niemand mehr fremde Bilder AUFLISTEN
//     (Fund A, Migration 20260827100812 — die SELECT-Policies gelten nur noch für den
//     eigenen Ordner), aber beide Buckets sind weiterhin öffentlich: wer die Adresse
//     einer Datei kennt, bekommt sie. § 11 sagt deshalb unverändert genau das.
//   - Er behauptet nicht, Umfragen seien nur für Angemeldete sichtbar — obwohl das seit
//     dem 27.08.2026 auch technisch stimmt: get_party_pools_by_invite_code ist seither
//     für anon gesperrt (Fund D, Migrationen 20260827100530 und ...549). Der Text bleibt
//     wie er ist; eine Zusage, die nicht gebraucht wird, muss nicht in einen Vertrag.
//
// § 13 und § 14 sind keine Kür: Art. 16 und 17 DSA gelten für jeden Hostingdienst. Die
// Ausnahme für Kleinstunternehmen in Art. 19 DSA erfasst nur die Art. 20 bis 24.
//
// Kein Gerichtsstand (gegenüber Verbrauchern unwirksam), keine Verbraucherschlichtung
// (§ 36 VSBG greift nicht, die EU-ODR-Plattform ist seit dem 20.07.2025 abgeschaltet),
// keine Linkhaftung — dieselbe Streichung wie im Impressum am 23.08.
const SECTIONS: LegalSection[] = [
  {
    paragraphs: [
      'Diese Bedingungen regeln die Nutzung von areuout. Mit der Erstellung eines Kontos stimmst du ihnen zu.',
      'Sie beschreiben die App, wie sie ist — jede Regel hier hat eine Entsprechung im Programm, und was das Programm nicht kann, wird hier auch nicht versprochen.',
    ],
  },
  {
    heading: '1. Was areuout ist',
    paragraphs: [
      'areuout ist eine App, mit der du private Partys erstellen, per Link teilen und Zu- oder Absagen verwalten kannst. Dazu kommen Umfragen, die ein Gastgeber seinen Gästen stellen kann.',
      'Anbieter ist Arthur Kunz, Bretschneiderstraße 14, 04229 Leipzig. Das Angebot ist kostenlos und wird ohne Gewinnerzielungsabsicht von einer Privatperson bereitgestellt — es gibt keine Werbung, keine kostenpflichtigen Funktionen und keine Bezahlvorgänge.',
      'Wir sind nicht Veranstalter der über die App organisierten Partys und nicht Vertragspartner zwischen Gastgeber und Gästen. Wir stellen nur das Werkzeug bereit.',
    ],
  },
  {
    heading: '2. Wie der Vertrag zustande kommt',
    paragraphs: [
      'Der Nutzungsvertrag kommt zustande, wenn du ein Konto anlegst und wir es bestätigen — bei der Anmeldung mit E-Mail-Adresse also, sobald du den zugeschickten Bestätigungscode eingibst. Ein Anspruch darauf, ein Konto zu bekommen, besteht nicht.',
      'Vertrags- und Kommunikationssprache ist Deutsch. Den Vertragstext speichern wir nicht für dich; du kannst diese Seite jederzeit aufrufen, ausdrucken oder sichern — auch ohne Konto.',
      'Ein Widerrufsrecht besteht nicht, und zwar nicht, weil wir es ausschließen, sondern weil die Vorschriften dazu diesen Vertrag nicht erfassen: Sowohl die Regeln über Fernabsatzverträge als auch die über Verträge über digitale Produkte (§§ 327 ff. BGB) setzen voraus, dass du einen Preis zahlst oder deine personenbezogenen Daten über die Bereitstellung der App hinaus verarbeitet werden. areuout kostet nichts, und deine Daten werden ausschließlich dafür verarbeitet, dir die App bereitzustellen. Du kannst dein Konto ohnehin jederzeit sofort und ohne Angabe von Gründen löschen — siehe § 18.',
    ],
  },
  {
    heading: '3. Mindestalter',
    paragraphs: [
      'Die Nutzung ist Menschen ab 16 Jahren gestattet. Mit der Anmeldung bestätigst du, dass du mindestens 16 Jahre alt bist.',
      'Wir erheben zur Prüfung kein Geburtsdatum, weil wir so wenig Daten wie möglich speichern wollen. Wir vertrauen auf deine Bestätigung. Erlangen wir Kenntnis davon, dass ein Konto von einer jüngeren Person geführt wird, löschen wir es.',
      'Bist du zwischen 16 und 18 Jahre alt, brauchst du für die Nutzung die Zustimmung deiner Eltern oder deines gesetzlichen Vertreters (§§ 106 ff. BGB). Mit der Anmeldung bestätigst du, dass diese Zustimmung vorliegt. Deine Eltern können sie uns gegenüber jederzeit widerrufen; wir löschen das Konto dann.',
    ],
  },
  {
    heading: '4. Dein Konto',
    paragraphs: [
      'Du legst ein Konto mit einer E-Mail-Adresse und einem Passwort an oder meldest dich mit Google an. Bei der Anmeldung per E-Mail schicken wir dir einen Bestätigungscode; ohne ihn wird das Konto nicht aktiv. Das Passwort muss mindestens acht Zeichen lang sein und einen Großbuchstaben, eine Zahl und ein Sonderzeichen enthalten.',
      'Die E-Mail-Adresse, mit der du dich angemeldet hast, lässt sich in der App nicht ändern — auch nicht, wenn du dich über Google angemeldet hast; das Konto hängt dann an dieser Google-Adresse. Willst du eine andere Adresse nutzen, musst du das alte Konto löschen und ein neues anlegen.',
      'Deine Zugangsdaten gehören dir allein; gib sie nicht weiter. Für alles, was über dein Konto geschieht, bist du verantwortlich. Hast du den Verdacht, dass jemand anderes Zugriff hat, ändere dein Passwort unter „Profil → Passwort" und sag uns Bescheid.',
      'Gib bei Vor- und Nachnamen den Namen an, unter dem andere Gäste dich erkennen. Konten, die erkennbar eine andere Person vortäuschen, können wir sperren.',
      'Pro Person ist ein Konto vorgesehen.',
    ],
  },
  {
    heading: '5. Der Einladungslink',
    paragraphs: [
      'Jede Party bekommt einen Link mit einem zufälligen Code. Dieser Code ist der einzige Schutz der Party: Wer ihn hat, kommt an sie heran, und wir prüfen dabei nicht, ob er eingeladen war.',
      'Wer den Link öffnet, sieht auch ohne Konto Titel, Beschreibung, Datum, Uhrzeit, Hintergrundbild und die Adresse. Die Gästeliste zeigt die App nur angemeldeten Gästen — sie wird nicht bloß ausgeblendet, der Server beantwortet die Anfrage ohne Konto gar nicht erst.',
      'Bist du angemeldet und noch nicht eingetragen, musst du zuerst zu- oder absagen; die Party-Seite öffnet sich danach.',
      'Wird der Link in einem Chat geteilt, erzeugt der Messenger daraus eine Vorschau mit Titel, Beschreibung und Hintergrundbild. Die Adresse steht bewusst nicht darin, weil sie sonst in fremden Chatverläufen und auf gesperrten Bildschirmen auftauchen würde.',
      'Ist eine Party vorbei, blendet die App die Adresse aus und nimmt keine Antworten mehr an. Der Link bleibt gültig und zeigt die Party weiterhin als vergangen.',
      'Gib den Link deshalb nur an Menschen weiter, die eingeladen sein sollen. Als Gastgeber bist du dafür verantwortlich, wem du ihn gibst; als Gast dafür, dass du ihn nicht ungefragt weiterleitest.',
    ],
  },
  {
    heading: '6. Wenn du eine Party erstellst',
    paragraphs: [
      'Für eine Party ist allein verantwortlich, wer sie erstellt hat — für ihren Ablauf, die Einhaltung von Hausrecht, Nachbarschaftsschutz, Jugendschutz und allen weiteren geltenden Vorschriften. Wir prüfen die Angaben zu einer Party nicht und übernehmen keine Gewähr für ihre Richtigkeit.',
      'Gib als Adresse nur einen Ort an, über den du verfügen darfst. Ist es eine Wohnung, denk daran, dass jeder mit dem Link sie sehen kann.',
      'Du kannst deine Party jederzeit ändern oder löschen. Mit dem Löschen verschwinden auch alle Zusagen, Umfragen, Antworten und das Hintergrundbild dieser Party — für alle Gäste, endgültig und ohne Vorwarnung an sie. Überleg dir das, wenn Leute bereits zugesagt haben.',
      'Wie viele Gäste zusagen dürfen, entscheidest du über die Gästezahl. Ist sie erreicht, lehnt die App weitere Zusagen ab.',
    ],
  },
  {
    heading: '7. Wenn du auf eine Einladung antwortest',
    paragraphs: [
      'Deine Antwort — zugesagt, vielleicht, abgesagt — sehen der Gastgeber und die übrigen Gäste derselben Party, zusammen mit deinem Vor- und Nachnamen und deinem Bild beziehungsweise deinen Initialen.',
      'Ein Anspruch auf einen Platz besteht nicht. Hat der Gastgeber eine Gästezahl gesetzt und ist sie erreicht, wird deine Zusage abgelehnt — auch dann, wenn du sie im selben Moment abschickst wie jemand anderes.',
      'Der Gastgeber kann dich jederzeit von seiner Gästeliste entfernen. Der Einladungslink funktioniert danach weiter, du könntest also erneut zusagen — ob das gewollt ist, klärt ihr unter euch, nicht über uns.',
      'Du kannst deine Antwort jederzeit ändern oder die Party über „Party für dich löschen" wieder verlassen. Über den Link kommst du jederzeit zurück.',
      'Die Zeit, Zusagen und Absagen zu koordinieren, ersetzt keine Absprache: Ob eine Party stattfindet, wie sie abläuft und wer hineinkommt, entscheidet der Gastgeber, nicht die App.',
    ],
  },
  {
    heading: '8. Umfragen',
    paragraphs: [
      'Als Gastgeber kannst du deinen Gästen Fragen stellen — mit vorgegebenen Antwortmöglichkeiten, als Freitext oder beides.',
      'Antworten sind nicht anonym und nicht privat: Deine Auswahl und dein Freitext sind für den Gastgeber und für alle anderen Gäste derselben Party sichtbar, mit deinem Namen daneben. Schreib in ein Freitextfeld nichts, was nicht die ganze Party lesen soll.',
      'Als Gastgeber darfst du über eine Umfrage keine Angaben abfragen, die besonders geschützt sind — Gesundheit, Herkunft, Religion, politische Meinung, sexuelle Orientierung oder Ähnliches. Auch nicht scherzhaft, und auch nicht als Antwortmöglichkeit zum Anklicken.',
    ],
  },
  {
    heading: '9. Die Daten der anderen Gäste',
    paragraphs: [
      'In einer Gästeliste siehst du die Namen, Bilder und Antworten anderer Menschen. Diese Angaben sind dir für diese eine Party anvertraut.',
      'Du darfst sie nicht kopieren, sammeln, veröffentlichen, an Dritte weitergeben oder für etwas anderes verwenden als für die Party, zu der sie gehören. Dasselbe gilt für die Adresse einer Party: Sie ist regelmäßig die Wohnung von jemandem und gehört weder in ein Chatprotokoll noch in ein soziales Netzwerk.',
      'Fotografierst oder filmst du auf einer Party, gelten die üblichen Regeln über Bildaufnahmen — die App ändert daran nichts.',
    ],
  },
  {
    heading: '10. Deine Inhalte',
    paragraphs: [
      'Titel, Beschreibungen, Adressen, Bilder und Umfragen, die du einstellst, bleiben deine Inhalte. Du räumst uns nur das Recht ein, sie im Rahmen der App zu speichern, technisch zu verarbeiten und den anderen Gästen deiner Party anzuzeigen. Dieses Recht endet, wenn du den Inhalt oder dein Konto löschst.',
      'Ein Bild, das du hochlädst, verändern wir dabei: Es wird verkleinert, als JPEG neu gespeichert und von den Angaben der Kamera befreit — insbesondere von GPS-Koordinaten, Gerätemodell und Aufnahmezeitpunkt. Gespeichert wird nur diese bereinigte Fassung, nicht deine Originaldatei. Erlaubt sind Bilddateien bis 5 MB.',
      'Du sicherst zu, dass du die nötigen Rechte an dem hast, was du hochlädst. Lade keine Bilder hoch, an denen andere Rechte haben, und keine Fotos von Personen ohne deren Einverständnis.',
    ],
  },
  {
    heading: '11. Bilder sind über ihre Adresse abrufbar',
    paragraphs: [
      'Profilbilder und Party-Hintergründe liegen in einem öffentlichen Dateispeicher. Wer die Adresse einer solchen Datei kennt, kann das Bild abrufen, auch ohne Konto und ohne Einladung.',
      'Wir sagen das hier so deutlich, weil es der naheliegenden Erwartung widerspricht. Lade nichts hoch, was unter keinen Umständen nach außen geraten darf.',
      'Lädst du ein neues Bild hoch oder wechselst du zurück zu den Initialen, wird das alte gelöscht und seine Adresse ungültig. Was in dieser Zeit bereits kopiert wurde, können wir nicht zurückholen.',
    ],
  },
  {
    heading: '12. Was nicht erlaubt ist',
    paragraphs: [
      'Untersagt sind insbesondere: rechtswidrige, beleidigende, diskriminierende, gewaltverherrlichende oder jugendgefährdende Inhalte; Belästigung anderer Nutzerinnen und Nutzer; Werbung und gewerbliche Veranstaltungen; das Vortäuschen einer fremden Identität.',
      'Ebenfalls untersagt sind automatisierte Zugriffe, das Durchprobieren von Einladungscodes, Versuche, die Zugriffsbeschränkungen der App zu umgehen, sowie das systematische Auslesen von Daten anderer Nutzerinnen und Nutzer.',
      'Nicht erlaubt ist außerdem, die App gewerblich zu nutzen, sie weiterzuverkaufen oder ihre Inhalte in einem anderen Dienst anzubieten.',
    ],
  },
  {
    heading: '13. Rechtswidrige Inhalte melden',
    paragraphs: [
      'Fällt dir in areuout ein Inhalt auf, den du für rechtswidrig hältst, melde ihn uns per E-Mail an azzuro.kunz@gmail.com. Diese Adresse ist zugleich unsere Kontaktstelle nach den Artikeln 11 und 12 der Verordnung (EU) 2022/2065 (Digital Services Act) — für Nutzerinnen und Nutzer wie für Behörden. Die Kommunikationssprache ist Deutsch.',
      'Damit wir etwas tun können, brauchen wir: eine Begründung, warum du den Inhalt für rechtswidrig hältst; den Einladungslink oder eine andere Angabe, mit der wir den Inhalt finden; deinen Namen und deine E-Mail-Adresse (außer bei Meldungen zu Straftaten gegen die sexuelle Selbstbestimmung); und die Bestätigung, dass deine Angaben nach bestem Wissen zutreffen.',
      'Wir bestätigen den Eingang deiner Meldung, prüfen sie zügig und sorgfältig und teilen dir unsere Entscheidung mit, samt einer Begründung und dem Hinweis, wie du dagegen vorgehen kannst.',
      'Meldungen bearbeitet ein Mensch — areuout ist ein privates Projekt, es gibt keine automatisierte Inhaltsprüfung. Wir durchsuchen die App auch nicht von uns aus nach Verstößen; wir werden tätig, wenn wir Kenntnis erlangen.',
    ],
  },
  {
    heading: '14. Was wir bei Verstößen tun',
    paragraphs: [
      'Verstößt ein Inhalt gegen diese Bedingungen oder gegen geltendes Recht, können wir ihn entfernen oder unsichtbar machen — eine einzelne Party, ein Bild, eine Umfrage oder einen Namen. Bei erheblichen oder wiederholten Verstößen können wir zusätzlich das Konto sperren oder löschen.',
      'Wir wählen dabei das mildeste Mittel, das ausreicht, und weisen dich vorher auf den Verstoß hin, soweit das möglich und zumutbar ist.',
      'Entfernen wir etwas oder sperren wir dein Konto, sagen wir dir, was wir getan haben und warum, auf welche Grundlage wir uns stützen und ob eine Meldung dahinterstand.',
      'Du kannst unserer Entscheidung widersprechen: formlos per E-Mail an die Adresse aus § 13, innerhalb von sechs Monaten. Wir sehen sie uns dann noch einmal an. Der Weg zu Gerichten und Behörden steht dir unabhängig davon offen.',
    ],
  },
  {
    heading: '15. Unsere eigenen Inhalte',
    paragraphs: [
      'Die App selbst, ihr Aufbau, ihre Texte und die vorgegebenen Hintergrundmotive, aus denen du beim Erstellen einer Party wählen kannst, gehören uns oder unseren Lizenzgebern.',
      'Du darfst sie innerhalb der App nutzen — mehr Rechte räumen wir dir daran nicht ein. Insbesondere darfst du die Hintergrundmotive nicht herunterladen und außerhalb von areuout verwenden.',
    ],
  },
  {
    heading: '16. E-Mails von uns',
    paragraphs: [
      'Wir schicken dir E-Mails, die zum Betrieb deines Kontos gehören: den Bestätigungscode bei der Anmeldung, die Nachricht zum Zurücksetzen deines Passworts und Hinweise zu Partys, zu denen du gehörst.',
      'Werbung verschicken wir nicht. Diese Servicenachrichten lassen sich nicht einzeln abbestellen — sie gehören zur Nutzung. Willst du sie nicht mehr bekommen, kannst du dein Konto löschen.',
    ],
  },
  {
    heading: '17. Verfügbarkeit, Änderungen und keine Datensicherung',
    paragraphs: [
      'areuout ist ein kostenloses Angebot in einer frühen Fassung. Es besteht kein Anspruch auf eine bestimmte Verfügbarkeit, auf bestimmte Funktionen oder darauf, dass Funktionen erhalten bleiben. Wartungsarbeiten, Störungen und Weiterentwicklungen können den Dienst zeitweise unterbrechen oder verändern.',
      'Wir führen keine Sicherungskopien deiner Daten, aus denen sich etwas wiederherstellen ließe. Was gelöscht wird — von dir, vom Gastgeber deiner Party oder durch einen technischen Fehler —, ist weg. Nutze areuout deshalb nicht als einzigen Ort, an dem etwas steht, das du behalten willst.',
      'Wir können den Dienst auch ganz einstellen. Das ist ein privates Projekt, kein Unternehmen. Ist es absehbar, kündigen wir es vorher in der App an, mit angemessenem Vorlauf; danach werden die gespeicherten Daten gelöscht.',
    ],
  },
  {
    heading: '18. Beendigung',
    paragraphs: [
      'Du kannst dein Konto jederzeit ohne Angabe von Gründen unter „Profil → Account" löschen. Das geschieht sofort und ist nicht rückgängig zu machen.',
      'Gelöscht werden dabei dein Profil, deine Bilder, deine Antworten auf fremde Einladungen — und alle Partys, die du erstellt hast, samt deren Zusagen, Umfragen und Antworten. Deine Gäste verlieren diese Partys damit ebenfalls, und ihre Einladungslinks führen ins Leere. Sag ihnen vorher Bescheid, wenn eine Party noch bevorsteht.',
      'Wir können ein Konto nach § 14 sperren oder löschen. Außerdem können wir den Nutzungsvertrag mit einer Frist von 14 Tagen ordentlich kündigen; die Kündigung geht an die E-Mail-Adresse deines Kontos.',
    ],
  },
  {
    heading: '19. Haftung',
    paragraphs: [
      'Wir haften unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit.',
      'Bei einfacher Fahrlässigkeit haften wir nur bei Verletzung einer wesentlichen Vertragspflicht — also einer Pflicht, deren Erfüllung die ordnungsgemäße Nutzung überhaupt erst ermöglicht und auf deren Einhaltung du vertrauen darfst — und begrenzt auf den vertragstypischen, vorhersehbaren Schaden.',
      'Für Schäden im Zusammenhang mit einer Party selbst haften wir nicht; dafür ist der Gastgeber verantwortlich. Ebenso wenig haften wir für Inhalte, die Nutzerinnen und Nutzer einstellen, und für den Verlust von Daten, die du entgegen § 17 nur hier gespeichert hast.',
      'Die Haftung nach dem Produkthaftungsgesetz bleibt unberührt.',
    ],
  },
  {
    heading: '20. Freistellung',
    paragraphs: [
      'Verletzt du mit deinen Inhalten oder mit deiner Nutzung der App die Rechte Dritter, stellst du uns von deren Ansprüchen frei — einschließlich der Kosten einer angemessenen Rechtsverteidigung.',
      'Das gilt nicht, soweit du die Verletzung nicht zu vertreten hast. Wir informieren dich, sobald jemand solche Ansprüche gegen uns erhebt.',
    ],
  },
  {
    heading: '21. Datenschutz',
    paragraphs: [
      'Welche Daten wir verarbeiten, wozu, wer sie zu sehen bekommt und welche Rechte du hast, steht in der Datenschutzerklärung. Sie ist Teil der Antwort auf jede Frage nach deinen Daten und geht diesen Bedingungen dort vor, wo es um die Verarbeitung geht.',
    ],
  },
  {
    heading: '22. Änderungen dieser Bedingungen',
    paragraphs: [
      'Wir können diese Bedingungen ändern, wenn sich die App oder die Rechtslage ändert. Über wesentliche Änderungen informieren wir dich in der App, bevor sie wirksam werden.',
      'Bist du nicht einverstanden, kannst du dein Konto löschen. Nutzt du die App nach dem Hinweis weiter, gelten die geänderten Bedingungen.',
    ],
  },
  {
    heading: '23. Schlussbestimmungen',
    paragraphs: [
      'Es gilt deutsches Recht. Ist eine Bestimmung dieser Bedingungen unwirksam, bleibt der übrige Teil davon unberührt.',
      'Verbraucherinnen und Verbraucher können sich unabhängig davon stets auf die zwingenden Vorschriften ihres Aufenthaltsstaats berufen.',
    ],
  },
]

export default function NutzungsbedingungenPage() {
  return <LegalTextScreen title='Nutzungsbedingungen' sections={SECTIONS} updated='26. August 2026' />
}
