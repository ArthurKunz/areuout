# areuout

Eine Web-App, mit der man private Partys anlegt, sie über einen Link teilt und
Zu- und Absagen verwaltet. Für Leute zwischen 16 und 26.

Das Problem, aus dem sie entstanden ist: Wer neu in einer Stadt oder an einer
Uni ist, erfährt von nichts. Was läuft, steht in der richtigen WhatsApp-Gruppe
oder in der Story der richtigen Person — beides hat man nicht, wenn man neu
ist. Gastgeber wiederum haben kein Werkzeug für Gästelisten; alles zerfasert
über Gruppenchats.

Betrieben von einer Privatperson, ohne Gewerbe und ohne Gewinnerzielungsabsicht.
Keine Werbung, keine Bezahlfunktionen, keine Datenweitergabe. Alle beteiligten
Dienste bleiben in ihren kostenlosen Tarifen.

## Stack

- Next.js 16, ausschließlich App Router
- TypeScript im strict mode
- Supabase (Postgres, Auth, Storage) — Row Level Security auf allen sechs Tabellen
- Tailwind CSS v4

## Entwickeln

```bash
npm install
cp .env.example .env.local   # Werte eintragen
npm run dev
```

Die App läuft dann auf http://localhost:3000.

```bash
npm run build   # Produktionsbuild
npm run lint    # ESLint
npx tsc --noEmit
```

## Umgebungsvariablen

Alles wird über `process.env` gelesen, nichts steht fest verdrahtet im Code.
`.env.example` ist die Kopiervorlage und die einzige versionierte .env-Datei.

| Variable | Wofür |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-Projekt |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase-Projekt. Liegt im Browser-Bundle — geschützt wird über RLS, nicht über Geheimhaltung |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Kartenvorschau (Static Maps API). Muss in der Google Cloud Console auf die eigene Domain beschränkt werden |
| `NEXT_PUBLIC_SITE_URL` | Die eigene Domain, sobald es sie gibt. Ohne den Wert nimmt `lib/site.ts` die Produktionsdomain von Vercel und danach localhost |

`SUPABASE_SERVICE_ROLE_KEY` wird im gesamten Quellcode nirgends verwendet und
gehört deshalb weder in `.env.local` noch in die Deployment-Konfiguration.

## Aufbau

```
app/            Routen (App Router)
  e/[invite_code]/   die öffentliche Einladungsseite
  impressum/, datenschutz/, nutzungsbedingungen/
                     die drei Rechtstexte — bewusst ohne Login erreichbar
features/       die großen Bausteine: auth, onboarding, parties, profile, settings
components/     geteilte UI
lib/            Supabase-Clients, Bildverarbeitung, Hilfsfunktionen
types/          generierte Supabase-Typen
supabase/       Migrationen
```

## Datenmodell

Sechs Tabellen: `profiles`, `events`, `rsvps`, `pools`, `pool_options`,
`pool_responses`. Die Tabelle heißt `events`, die App nennt sie überall Party —
PostgREST-Embeds müssen deshalb `parties:events(...)` schreiben.

Kein Geburtsdatum, kein Alter, kein Geschlecht, keine Telefonnummer, kein
Gerätestandort. Die Altersgrenze von 16 Jahren steht in den Nutzungsbedingungen,
nicht in einer Spalte.

Details in [SCHEMA.md](SCHEMA.md), einschließlich aller RLS-Policies,
CHECK-Constraints und der Stellen, an denen ein Trigger statt einer Policy
nötig war.

## Weitere Dateien

- [CLAUDE.md](CLAUDE.md) — die verbindlichen Projektregeln, auch für Menschen die kürzeste Übersicht
- [SCHEMA.md](SCHEMA.md) — Datenmodell, RLS, Constraints
- [RECHTLICHES-BESTANDSAUFNAHME.md](RECHTLICHES-BESTANDSAUFNAHME.md) — was die App datenschutzrechtlich tut, gegen den Code geprüft

## Stand

V1 in Arbeit, Ziel Juli 2026. Noch nicht veröffentlicht.

### Vor dem Launch offen

Stand 27.08.2026. Was hier steht, blockiert die Veröffentlichung oder gehört
unmittelbar dazu — erledigte Punkte werden gestrichen, nicht abgehakt.

`npm run build` läuft. Falls er in einer Sitzung doch einmal beim Prerendern mit
`TypeError: Cannot read properties of null (reading 'useContext')` abbricht: dann ist
`NODE_ENV` auf `development` gesetzt. `next build` mischt dann Entwicklungs- und
Produktionsbuild von React, und der Renderer steht ohne Dispatcher da. `env -u NODE_ENV
npm run build` beweist es in einem Durchlauf.

**Hosting und Dienste**

- Domain kaufen, Vercel-Projekt anlegen (der Projektname wird die Fallback-Domain in
  `lib/site.ts`), Umgebungsvariablen setzen, danach `NEXT_PUBLIC_SITE_URL` eintragen.
- Supabase → Authentication → URL Configuration auf die Domain stellen, sonst brechen
  Google-Login und Passwort-Reset in der Produktion.
- Google Cloud: Maps-Key auf die Domain beschränken, OAuth-Consent-Screen
  veröffentlichen.
- Resend anschliessen: Domain verifizieren, in Supabase als Custom SMTP eintragen,
  Auth-Mailvorlagen auf Deutsch.
- Auftragsverarbeitungsverträge bestätigen: Supabase, Vercel, Resend.

**Sicherheit**

- Die Bild-Buckets sind öffentlich. Auflisten kann seit dem 27.08. niemand mehr, aber
  wer eine Datei-URL kennt, bekommt das Bild. Nächste Stufe wären private Buckets mit
  signierten URLs — betrifft jedes `<img src>` der App.

**Aufräumen**

- Den Löschpfad der App einmal wirklich durchlaufen: Konto anlegen, Bild hochladen,
  Party mit eigenem Hintergrund erstellen, dann Profil → Account → Account löschen.
  Danach müssen Tabellen UND Buckets leer sein. Die Datenschutzerklärung sichert das in
  Abschnitt 11 zu; beobachtet wurde es noch nie.
- `types/database.types.ts` an die Supabase-Clients hängen (`createBrowserClient<Database>`)
  oder löschen. Aktuell ist die Datei korrekt, aber ungenutzt, und deckt die Casts in
  `parties.service.ts` zu.
- Der lokale Projektordner heisst noch `student-connect`.
