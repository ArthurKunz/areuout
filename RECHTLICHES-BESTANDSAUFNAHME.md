# Datenschutz-Bestandsaufnahme — areuout

Erhoben am 23.08.2026 gegen den Stand `f74925d`, nachgetragen nach den Umbauten vom
selben Tag. Was inzwischen behoben ist, steht als **BEHOBEN** dabei. Grundlage für Impressum und
Datenschutzerklärung nach DSGVO, Standort Deutschland.

Jede Aussage ist mit Datei und Zeile belegt oder empirisch geprüft. Was sich aus dem
Repository nicht feststellen ließ, steht als **UNKLAR – manuell prüfen** und ist unten
in „Offene Punkte" gesammelt. Nichts davon ist geraten.

**Das ist eine technische Bestandsaufnahme, keine Rechtsberatung.**

---

## 0. Betreiber

Betrieben wird die App von einer **Privatperson**, nicht von einem Unternehmen.

- **Kein Gewerbe angemeldet** und keins geplant.
- **Keine Einnahmeabsicht** — weder jetzt noch für V1. Keine Werbung, keine
  Bezahlfunktionen, keine Provisionen, keine kostenpflichtigen Konten, keine
  Datenweitergabe gegen Entgelt.
- Damit ist das Angebot **nicht geschäftsmäßig** im Sinne von § 5 DDG.

Was daraus folgt, praktisch:

| Bereich | Auswirkung |
|---|---|
| **Impressum** | Die Pflicht aus § 5 DDG hängt an einem *geschäftsmäßigen* Angebot — und geschäftsmäßig heißt nach herrschender Lesart **nachhaltig und planmäßig**, nicht gewinnorientiert. Fehlende Gewinnerzielungsabsicht befreit also gerade nicht. Eine dauerhaft betriebene App für fremde Nutzer dürfte darunter fallen, das Impressum ist damit **voraussichtlich Pflicht** und steht seit dem 23.08. vollständig. **UNKLAR – manuell prüfen**, siehe Punkt 14 |
| **DSGVO** | Gilt **unverändert**. Die Haushaltsausnahme aus Art. 2 Abs. 2 lit. c greift hier nicht: die App richtet sich an fremde Nutzer, nicht an den eigenen Familien- und Bekanntenkreis. Datenschutzerklärung, Löschkonzept und AV-Verträge bleiben also erforderlich |
| **AV-Verträge** | Weiterhin nötig. Auch eine Privatperson ist Verantwortlicher nach Art. 4 Nr. 7 DSGVO |
| **Steuer** | Kein Thema, solange kein Geld fließt |
| **Anbieter-Tarife** | Supabase, Vercel und Google Maps müssen in ihren kostenlosen Stufen bleiben. Reißt das Projekt eine Grenze, ist die Frage „Gewerbe ja/nein“ neu zu stellen, bevor irgendetwas gebucht wird |

Wenn sich das jemals ändert — Werbung, Bezahlfunktion, Sponsoring —, ist diese
Bestandsaufnahme an dieser Stelle als Erstes zu überarbeiten.

---

## 1. Drittdienste

Durchsucht: `package.json`, `.env.example`, `next.config.ts`, `postcss.config.mjs`,
`app/`, `components/`, `features/`, `lib/`, `proxy.ts`. Deployment-Configs
(`vercel.json`, `Dockerfile`, `.github/`) existieren nicht.

| Dienst | Zweck im Projekt | Fundstelle | Firmensitz | Serverstandort |
|---|---|---|---|---|
| **Supabase** | Datenbank, Nutzerkonten, Authentifizierung, Datei-Speicher | `package.json:12–13`, `lib/supabase/client.ts:3`, `lib/supabase/server.ts:20`, `proxy.ts:40`, `app/(auth)/callback/route.ts:13` | Supabase Inc., USA | **UNKLAR – manuell prüfen** (siehe 5.) |
| **Cloudflare** | Liegt vor der Supabase-API und dem Bilder-Speicher, terminiert TLS | Nicht im Code — empirisch: Antwort-Header `server: cloudflare`, `cf-ray: …-TXL` auf `/rest/v1/` und `/storage/v1/` | Cloudflare Inc., USA | Globales Anycast-Netz |
| **Google Maps Static API** | Kartenvorschau auf der Party-Detailseite | `features/parties/components/PartyMap.tsx:6, 10` | Google Ireland Ltd. | **UNKLAR – manuell prüfen** (USA nicht ausgeschlossen) |
| **Google Maps (Weblink)** | „In Google Maps öffnen" — nur bei Klick | `features/parties/components/PartyMap.tsx:11` | Google Ireland Ltd. | s. o. |
| **Google Sign-In (OAuth)** | Optionale Anmeldung, nur wenn der Nutzer sie wählt | `features/auth/services/auth.service.ts:15–16` | Google Ireland Ltd. | s. o. |
| **Photon (komoot)** | Adresssuche beim Erstellen einer Party | `features/parties/components/AddressSearchField.tsx:16, 118–119` | komoot GmbH, Potsdam (DE) | **UNKLAR – manuell prüfen** |
| **Vercel** | Hosting — **noch nicht aktiv** | Kein `.vercel`-Verzeichnis, keine `vercel.json`. Nur vorbereitet in `lib/site.ts:26` (`VERCEL_PROJECT_PRODUCTION_URL`) | Vercel Inc., USA | Noch nicht gewählt |

### Ausdrücklich NICHT vorhanden

Geprüft und mit null Treffern belegt:

| Kategorie | Ergebnis |
|---|---|
| Analytics / Tracking | Keine. Kein Google Analytics, Plausible, PostHog, Matomo |
| Error-Tracking | Keine. Kein Sentry, Bugsnag, Rollbar |
| Payment | Keine |
| Werbung, Social Plugins | Keine |
| E-Mail-Versand durch die App | Kein eigener Versand. Bestätigungs- und Passwort-Mails verschickt Supabase Auth |
| CDN für Skripte/Styles | Keiner. Kein unpkg, jsdelivr, cdnjs |

**Cloudflare ist der Fund, den man beim Lesen des Codes verpasst.** Es steht nirgends
in `package.json` und wird nirgends aufgerufen — Supabase setzt es selbst vor seine
API. Jede Datenbankabfrage und jeder Bildabruf läuft also über einen weiteren
Auftragsverarbeiter. Das gehört in die Datenschutzerklärung.

---

## 2. Externe Ressourcen im Frontend

Durchsucht: `app/layout.tsx`, `app/globals.css`, alle Komponenten auf `<link>`,
`<script>`, `@import`, `url()`.

| Domain | Was wird geladen | Wann | Fundstelle |
|---|---|---|---|
| `maps.googleapis.com` | Karten-PNG (Static Maps API) | **Automatisch**, sobald eine Party-Detailseite geöffnet wird — ohne Zutun des Nutzers | `features/parties/components/PartyMap.tsx:10` |
| `photon.komoot.io` | Adress-Vorschläge (JSON) | Beim Tippen einer Adresse, sobald 400 ms Pause entstehen und mindestens 3 Zeichen stehen — nicht erst beim Absenden | `features/parties/components/AddressSearchField.tsx:16, 104–137` |
| `www.google.com` | Nichts — reines Linkziel | Nur wenn der Nutzer die Karte antippt | `features/parties/components/PartyMap.tsx:11` |

> **Korrektur zur ersten Fassung dieses Dokuments.** Dort stand, die Adresssuche
> schicke „bei jedem Tastendruck" eine Anfrage. Das war falsch: Der Effekt entprellt,
> jeder Tastendruck löscht den anstehenden Timer und setzt einen neuen. Es geht eine
> Anfrage bei jeder Tippause raus, nicht eine pro Zeichen. Seit dem 23.08. zusätzlich
> erst ab drei Zeichen.

### Schriftarten: selbst gehostet — kein Google-Fonts-Problem

Das ist der Punkt, an dem viele deutsche Projekte hängen (Stichwort LG München,
20.01.2022, Az. 3 O 17493/20). Hier ist er sauber:

| Prüfung | Ergebnis |
|---|---|
| Einbindung | `app/layout.tsx:3` — `import { Geist, Geist_Mono } from 'next/font/google'` |
| Verhalten | Next lädt die Schriften **zur Build-Zeit** herunter und liefert sie vom eigenen Server |
| Belegt durch | 11 `.woff2`-Dateien unter `.next/static/media/` im fertigen Build |
| Gegenprobe | Kein einziger Verweis auf `fonts.googleapis.com` oder `fonts.gstatic.com` in `.next/static` oder `.next/server` |

**Es geht keine Anfrage vom Browser des Nutzers an einen Google-Font-Server.** Die
IP-Adresse des Besuchers erreicht Google über die Schriften also nicht.

---

## 3. Personenbezogene Daten

Erhoben direkt aus der Live-Datenbank über `pg_attribute`, nicht aus den
Migrationsdateien — der Ordner `supabase/migrations/` ist nachweislich unvollständig
(siehe `supabase/migrations/README.md`).

### `profiles` — angelegt bei `features/onboarding/OnboardingScreen.tsx:41`

| Spalte | Typ | Personenbezug |
|---|---|---|
| `id` | uuid | **Ja** — identisch mit `auth.users.id` |
| `firstname` | text | **Ja** — Klarname |
| `lastname` | text | **Ja** — Klarname |
| `avatar_url` | text | **Ja** — Porträtfoto, wenn hochgeladen |
| `avatar_color` | text | Nein |
| `created_at` | timestamptz | Mittelbar — Anmeldezeitpunkt |

### `events` — angelegt bei `features/parties/services/parties.service.ts:6`

| Spalte | Typ | Personenbezug |
|---|---|---|
| `host_id` | uuid | **Ja** — Verweis auf die Person |
| `title`, `description` | text | Mittelbar — Freitext, kann Namen enthalten |
| `location` | text | **Ja, besonders sensibel** — regelmäßig eine Privatanschrift |
| `invite_code` | text | Nein — aber das einzige Zugangsgeheimnis der Party. Seit 23.08. 12 Zeichen base32 (60 Bit) aus `crypto.getRandomValues`; vorher 10 Hex (40 Bit) mit `Math.random`-Rueckfall. Die anonyme Abfrage hat **kein Rate-Limit** (gemessen: 150/150 bei 55/s) |
| `event_date`, `ends_at` | timestamptz | Mittelbar — Aufenthaltszeitpunkt |
| `max_guests` | integer | Nein |
| `background_url` | text | Mittelbar — hochgeladenes Bild kann Personen zeigen |
| `event_type` | text | Nein — ungenutzt, kein UI |

### `rsvps` — geschrieben bei `features/parties/services/parties.service.ts:252`

| Spalte | Typ | Personenbezug |
|---|---|---|
| `user_id` | uuid | **Ja** |
| `event_id` | uuid | **Ja, in Verbindung** — belegt Teilnahme an einer konkreten Veranstaltung an einem Ort zu einer Zeit |
| `status` | text | **Ja, in Verbindung** — zugesagt / vielleicht / abgesagt |
| `responded_at` | timestamptz | Mittelbar |

### `pools`, `pool_options`, `pool_responses`

| Tabelle | Spalte | Personenbezug |
|---|---|---|
| `pools` | `question`, `description` | Mittelbar — Freitext des Gastgebers |
| `pool_options` | `label` | Mittelbar — Freitext |
| `pool_responses` | `user_id` | **Ja** |
| `pool_responses` | `option_id`, `text_response` | **Ja, in Verbindung** — Meinungsäußerung einer benannten Person |

### Nicht erhoben

Positiv festzuhalten und in der Erklärung erwähnenswert: **kein Geburtsdatum, kein
Alter, kein Geschlecht, keine Telefonnummer, keine Adresse des Nutzers selbst, keine
Standortdaten des Geräts.** Die 16-Jahre-Grenze wird über die Nutzungsbedingungen
gelöst statt über ein Datenfeld (`app/nutzungsbedingungen/page.tsx`, § 2).

### IP-Adressen, User-Agents, Geodaten

| Ebene | Ergebnis |
|---|---|
| Anwendungscode | **Erhebt nichts davon.** Kein Zugriff auf `headers()`, `x-forwarded-for`, `user-agent`, `navigator.geolocation` — null Treffer |
| Serverseitige Protokollierung | Drei `console.error`: `app/error.tsx:25`, `app/(auth)/callback/route.ts:38, 56`. Loggen Fehlerobjekte, keine Nutzerdaten — landen in den Logs des Hosters |
| Plattformebene | Supabase, Cloudflare und der spätere Hoster protokollieren IP-Adressen zwangsläufig selbst. **UNKLAR – manuell prüfen**, welche Fristen dort gelten |

### Öffentlich abrufbare Bilder — nachgeprüft

| Bucket | Öffentlich | Max. Größe | Erlaubte Typen |
|---|---|---|---|
| `avatars` | **Ja** | 5 MB | jpeg, png, webp, gif |
| `event-backgrounds` | **Ja** | 10 MB | jpeg, png, webp, gif |

Empirisch bestätigt: Der Abruf einer Bild-URL **ohne Anmeldung und ohne API-Key**
liefert `HTTP 200, image/jpeg, 78.509 Bytes`.

#### Die Dateien liessen sich auflisten — BEHOBEN

Die Annahme „unerratbare URL" war falsch. Mit dem anon-Key, der im Browser-Bundle liegt
und damit jedem zur Verfügung steht:

```
POST /storage/v1/object/list/avatars              -> jede Nutzer-ID
POST /storage/v1/object/list/avatars {"prefix":…} -> jeder Dateiname
```

Damit konnte **jeder Beliebige sämtliche hochgeladenen Bilder der App herunterladen**,
nicht nur wer eine URL kannte. Ursache waren zwei SELECT-Policies für die Rolle
`public`, die `anon` einschliesst.

**BEHOBEN** durch Migration `20260823120855_stop_anyone_from_listing_the_buckets`: alle
Storage-Policies stehen jetzt auf `authenticated`. Gemessen danach — Auflisten durch
anon liefert `[]`, eine Signed URL durch anon scheitert mit 404, der Bild-Abruf über
die öffentliche URL liefert weiter 200.

#### Was bleibt

**Eine einmal bekannte Bild-URL funktioniert weiterhin dauerhaft für jeden.** Man
bekommt sie nur, wenn man die Person oder die Party legitim gesehen hat, und man kann
nicht mehr herausfinden, welche Bilder überhaupt existieren. Das gehört trotzdem in die
Datenschutzerklärung, weil es der Erwartung „mein Profilbild sehen nur andere Gäste"
widerspricht.

#### Hochgeladene Fotos enthielten GPS-Koordinaten — BEHOBEN

Der schwerwiegendste Einzelfund. Ein reales Avatar aus dem Bucket, ausgelesen:

| | |
|---|---|
| GPS | **51.3456 N, 12.3606 E** (Leipzig) |
| Gerät | iPhone 12 Pro, iOS 14.7.1 |
| Aufnahme | 29.08.2021, 21:45 Uhr |
| Datei | 2569 × 3347 px, 1.081.481 Bytes, unverändert wie aus der Kamera |

Wer die URL hatte, konnte auslesen, **wo und wann** das Foto gemacht wurde.

**BEHOBEN** durch `lib/image.ts`: Jedes ausgewählte Bild wird vor dem Hochladen über
ein Canvas neu kodiert. Ein Canvas hält nur Pixel — EXIF, GPS und Herstellernotizen
überleben den Umweg nicht. Zusätzlich wird verkleinert (Avatare 512 px, Hintergründe
1600 px). Am selben Bild nachgerechnet: 393 × 512 px, 32.568 Bytes, 0 EXIF-Felder,
kein GPS-Block — 97 % kleiner.

Gilt für alle künftigen Uploads. **Bereits hochgeladene Bilder tragen ihre Metadaten
weiterhin** und müssten neu hochgeladen oder einmalig nachbearbeitet werden.

Upload-Fundstellen: `features/onboarding/components/ProfilePictureForm.tsx:82–84`,
`features/profile/EditPictureScreen.tsx:109–111`,
`features/parties/CreatePartyScreen.tsx:272–274`.

---

## 4. Cookies und Client-Storage

### Cookies

Empirisch geprüft: `/`, `/login`, `/impressum` und `/e/[code]` liefern beim ersten
anonymen Aufruf **keinen einzigen `Set-Cookie`-Header**.

| Cookie | Von wem | Zweck | Laufzeit | Einordnung |
|---|---|---|---|---|
| `sb-<projekt-ref>-auth-token` (ggf. in `.0`, `.1` … zerlegt) | Supabase Auth über `@supabase/ssr` | Hält die Anmeldung; enthält Access- und Refresh-Token | **400 Tage** (`maxAge: 400*24*60*60`) | **Technisch notwendig** — ohne sie ist keine Anmeldung möglich |

Cookie-Eigenschaften aus `node_modules/@supabase/ssr/dist/module/utils/constants.js:1–7`:
`path: "/"`, `sameSite: "lax"`, `httpOnly: false`, `maxAge: 400 Tage`.
Das Projekt setzt **keine** eigenen `cookieOptions` — es gelten überall diese Standardwerte.

Zwei Anmerkungen, die keine Rechtsfragen sind, aber auffallen:

- **`httpOnly: false`** ist Absicht der Bibliothek (der Browser-Client muss das Token
  lesen können), bedeutet aber, dass JavaScript im Seitenkontext an das Token käme.
- **400 Tage** ist die längste Laufzeit, die Chrome überhaupt akzeptiert. Für die
  Erklärung ist das die zu nennende Zahl.

### localStorage / sessionStorage

| Prüfung | Ergebnis |
|---|---|
| Eigener Quellcode | **Null Treffer** in `app/`, `components/`, `features/`, `lib/`, `proxy.ts` |
| Client-Bundle | Ein Treffer, in `@supabase/gotrue-js` |
| Wird der Zweig erreicht? | **Nein.** `createBrowserClient` übergibt einen Cookie-Adapter als `auth.storage` — belegt in `node_modules/@supabase/ssr/dist/module/createBrowserClient.js:16, 39`. Der `localStorage`-Fallback von gotrue greift nur, wenn *kein* Adapter übergeben wird |
| Rest | gotrue liest einmal den Schlüssel `supabase.gotrue-js.locks.debug` — ein Debug-Schalter, der nicht gesetzt ist |

**Die Sitzung liegt in Cookies, nicht im localStorage.** Ein Cookie-Banner ist nach
§ 25 Abs. 2 Nr. 2 TDDDG nicht erforderlich, weil ausschließlich technisch notwendige
Cookies gesetzt werden — und für Besucher ohne Konto gar keine.

---

## 5. Datenflüsse in Drittländer

| Dienst | Drittland? | Grundlage / Anmerkung |
|---|---|---|
| **Supabase** | **Nein — EU** | Am 26.08.2026 geklärt: Die API-Domain hilft nicht weiter, sie löst auf Cloudflare-IPs auf (`172.64.149.246`, `104.18.38.10`). Die Datenbank selbst verrät sich aber: `db.<ref>.supabase.co` → `2a05:d014:128e:9500:…`, und dieses Präfix steht in der AWS-Liste `ip-ranges.json` unter `eu-central-1` — Frankfurt am Main. Die Datenbank liegt damit in der EU; das US-Mutterunternehmen bleibt davon unberührt |
| **Cloudflare** | **Ja, faktisch** | Globales Anycast-Netz, Unternehmen in den USA. Der Datenverkehr wird am nächstgelegenen Randknoten terminiert (hier Berlin), das schließt eine Verarbeitung in den USA aber nicht aus |
| **Google** (Maps, Sign-In) | **Ja** | Google Ireland Ltd. als Vertragspartner, Übermittlung in die USA nicht ausgeschlossen. Google ist unter dem EU-US Data Privacy Framework zertifiziert |
| **Photon / komoot** | Voraussichtlich nein | komoot GmbH sitzt in Potsdam. **UNKLAR – manuell prüfen**, wo Photon tatsächlich betrieben wird |
| **Vercel** | **Ja, wenn gewählt** | Unternehmen in den USA. Region ist wählbar, noch nicht entschieden |

---

## 6. Löschkonzept

### Account-Löschung durch den Nutzer

Vorhanden, unter „Profil → Account". Ablauf in `features/profile/AccountScreen.tsx`:

| Schritt | Zeile | Was passiert |
|---|---|---|
| 1 | `:33` | Rückfrage `confirm(...)` |
| 2 | `:40` | `removeStorageFolder('avatars', user.id)` — Profilbilder |
| 3 | `:41` | `removeStorageFolder('event-backgrounds', user.id)` — Party-Hintergründe |
| 4 | `:44` | `supabase.rpc('delete_self')` |

Die Reihenfolge ist bewusst so: Die Storage-Regeln prüfen `auth.uid()`, nach dem
Löschen des Kontos käme also niemand mehr an die Dateien. Hilfsfunktionen in
`lib/storage.ts:10` und `:24`.

### Was `delete_self()` tatsächlich löscht

Die Funktion selbst ist eine Zeile — `delete from auth.users where id = auth.uid()`.
Alles Weitere erledigen Fremdschlüssel. Kaskade aus `information_schema` geprüft:

| Von | Nach | Regel |
|---|---|---|
| `public.profiles.id` | `auth.users.id` | **CASCADE** |
| `public.events.host_id` | `public.profiles.id` | **CASCADE** |
| `public.rsvps.user_id` | `public.profiles.id` | **CASCADE** |
| `public.rsvps.event_id` | `public.events.id` | **CASCADE** |
| `public.pools.event_id` | `public.events.id` | **CASCADE** |
| `public.pool_options.pool_id` | `public.pools.id` | **CASCADE** |
| `public.pool_responses.user_id` | `public.profiles.id` | **CASCADE** |
| `public.pool_responses.pool_id` | `public.pools.id` | **CASCADE** |
| `public.pool_responses.option_id` | `public.pool_options` | SET NULL |

**Die Kette ist lückenlos.** Konto → Profil → eigene Partys → deren Zusagen, Umfragen
und Antworten. Zusätzlich verschwinden die Zusagen und Umfrageantworten, die die Person
bei *fremden* Partys abgegeben hat, über `user_id`. Die Zusage einer Löschung „alle
Daten werden entfernt" ist damit gedeckt.

Zwei Einschränkungen, die man kennen sollte:

1. `pool_responses.option_id` ist `SET NULL`, nicht CASCADE. Das betrifft nur den Fall,
   dass eine *Antwortmöglichkeit* gelöscht wird — die abgegebene Antwort bleibt dann
   ohne Bezug bestehen. Bei einer Kontolöschung greift `user_id` CASCADE und die Zeile
   verschwindet ganz.
2. Schlägt Schritt 2 oder 3 fehl, wird trotzdem gelöscht. Dann bleiben verwaiste Bilder
   im Speicher, ohne Zeile, die auf sie zeigt. Nicht abgefangen.

### Löschung einer einzelnen Party

`features/parties/services/parties.service.ts` — löscht die Zeile und danach den
Bildordner `{host_id}/{party_id}`. Zusagen, Umfragen und Antworten gehen über die
Kaskade mit.

### Automatische Löschfristen für Logs

**UNKLAR – manuell prüfen.** Die Anwendung führt keine eigenen Logs. Fristen für
Supabase-, Cloudflare- und Hoster-Logs sind Sache der jeweiligen Anbieter und hängen am
gebuchten Tarif.

---

## Offene Punkte

Alles, was du selbst klären oder ergänzen musst.

### Muss vor Veröffentlichung geklärt werden

| # | Punkt | Wo nachsehen |
|---|---|---|
| 1 | **Supabase-Region** — **BEHOBEN am 26.08.2026: `eu-central-1`, Frankfurt am Main.** `db.<ref>.supabase.co` löst auf `2a05:d014:128e:9500:…` auf; AWS führt `2a05:d014::/35` in `ip-ranges.json` unter `eu-central-1`. Für die Kerndaten liegt damit keine Drittlandübermittlung vor. Steht so in der Erklärung | gemessen; zur Sicherheit gegen Dashboard → Settings → General halten |
| 2 | **AV-Vertrag mit Supabase** abschließen oder bestätigen | Supabase-Dashboard → Settings → Legal / Compliance |
| 3 | **Cloudflare in die Erklärung aufnehmen** — steht nirgends im Code, ist aber an jeder Abfrage beteiligt. Klären, ob der Supabase-AV-Vertrag Cloudflare als Unterauftragsverarbeiter abdeckt | Unterauftragsverarbeiter-Liste von Supabase |
| 4 | **Hoster festlegen** und AV-Vertrag schließen. Vercel ist bisher nur vorbereitet, nicht gewählt | — |
| 5 | **Photon / komoot**: Betriebsstandort und Rechtsgrundlage klären. Die Suche ist seit dem 23.08. entprellt (400 ms) und feuert erst ab drei Zeichen — was übertragen wird, ist der eingetippte Adressanfang samt IP | `features/parties/components/AddressSearchField.tsx:16, 104–137` |
| 6 | **Google Maps**: Der Kartenabruf passiert ungefragt beim Öffnen der Party-Seite. Prüfen lassen, ob das ohne Einwilligung tragfähig ist, oder die Karte erst nach Klick laden | `features/parties/components/PartyMap.tsx:10` |
| 6a | **Rate-Limiting** auf `get_party_by_invite_code` einrichten (Cloudflare oder Supabase). Gemessen: keins vorhanden. Der laengere Code entschaerft das, beseitigt es aber nicht | Cloudflare-Regel oder Supabase-Einstellung |
| 7 | **Log-Fristen** von Supabase, Cloudflare und Hoster erfragen und in die Erklärung schreiben | Tarif-Dokumentation der Anbieter |
| 8 | **Anschrift und Kontakt-E-Mail** eintragen — **BEHOBEN**. Impressum am 23.08. (Bretschneiderstraße 14, 04229 Leipzig, Telefon und E-Mail), dabei auf die reinen Pflichtangaben nach § 5 DDG gekürzt. Datenschutz und Nutzungsbedingungen am 26.08.: die letzten `«...»` sind gefüllt, im Quelltext steht kein Platzhalter mehr | `app/datenschutz/page.tsx`, `app/nutzungsbedingungen/page.tsx` |
| 14 | **Impressumspflicht bei rein privatem Betrieb** bestätigen lassen — kein Gewerbe, keine Einnahmen, aber „geschäftsmäßig“ verlangt keine Gewinnabsicht, siehe Abschnitt 0. Die Seite steht vorsorglich vollständig; zu klären bleibt nur, ob die Privatanschrift wirklich öffentlich stehen muss | Abschnitt 0, `app/impressum/page.tsx` |

### Inhaltlich zu entscheiden

| # | Punkt | Warum |
|---|---|---|
| 9 | **Öffentliche Bild-URLs** in der Erklärung benennen | Auflisten ist gesperrt, der Abruf per bekannter URL bleibt möglich. Widerspricht der naheliegenden Erwartung und gehört benannt |
| 10 | **Party-Adressen** als eigenen Punkt behandeln | Regelmäßig eine Privatanschrift, sichtbar für jeden mit dem Einladungslink — auch ohne Konto |
| 11 | **Cookie-Laufzeit 400 Tage** nennen oder verkürzen | Standardwert der Bibliothek, lässt sich über `cookieOptions` setzen |
| 12a | **Altbestand mit EXIF** — vor dem 23.08. hochgeladene Bilder tragen weiterhin GPS | Entscheiden: neu hochladen lassen, einmalig nachbearbeiten oder hinnehmen |
| 12 | **Verwaiste Bilder** bei fehlgeschlagener Löschung | Bewusst hinnehmen oder absichern — betrifft die Zusage „vollständig gelöscht" |
| 13 | **Fehlerüberwachung** (Sentry o. ä.) einführen? | Derzeit keine. Kommt eine dazu, wird sie ein weiterer Auftragsverarbeiter und muss in die Erklärung |

### Kein Handlungsbedarf — nur zur Kenntnis

| Punkt | Ergebnis |
|---|---|
| Google Fonts | Selbst gehostet, keine Anfrage an Google. Kein Handlungsbedarf |
| Cookie-Banner | Nicht erforderlich, solange nur die Auth-Cookies gesetzt werden |
| Analytics, Tracking, Payment | Nicht vorhanden — und laut Abschnitt 0 auch nicht vorgesehen |
| localStorage | Wird nicht genutzt |
| Anonyme Besucher | Bekommen keine Cookies |
| Löschkaskade | Lückenlos, geprüft. Ein verwaistes Avatar eines gelöschten Kontos wurde am 23.08. entfernt |
| Auflisten der Buckets | Gesperrt, geprüft |
| EXIF/GPS in neuen Uploads | Wird entfernt, geprüft |
| Kein Geburtsdatum, Geschlecht, Telefonnummer, Gerätestandort | Wird nicht erhoben — als Datensparsamkeit erwähnenswert |

---

## Nachtrag 26.08.2026 — Prüfung für die neue Datenschutzerklärung

Erhoben beim Neuschreiben von `app/datenschutz/page.tsx`. Alles hier ist an der
**Live-Datenbank** oder an der **Antwort des jeweiligen Servers** geprüft, nicht an den
Migrationsdateien.

### Neue Funde

| # | Fund | Beleg |
|---|---|---|
| A | **Jeder angemeldete Account kann beide Bild-Buckets auflisten und jedes Bild herunterladen.** Die SELECT-Policies heißen `avatars_select_authenticated` und `event_backgrounds_select_authenticated` und lauten schlicht `bucket_id = '…'` — ohne Ordner-Einschränkung. Die Migration vom 23.08. hat `anon` ausgesperrt, angemeldete Fremde aber nicht | `pg_policies`, Schema `storage` |
| B | **Die Bildpfade sind nicht zufällig.** `{user_id}/avatar-{ms}.jpg` und `{host_id}/{party_id}/background.jpg`. Host-Id und Party-Id liefert `get_party_by_invite_code` an **jeden** mit dem Einladungscode, auch ohne Konto — der Hintergrund einer Party ist damit aus dem Link ableitbar | `ProfilePictureForm.tsx:92`, `EditPictureScreen.tsx:116`, `CreatePartyScreen.tsx:277` |
| C | **Die Edge Function `send-consent-email` ist deployt und aktiv** (Version 4, `verify_jwt: true`). Sie ruft **Resend** auf und verschickt E-Mails an eine frei übergebene Adresse. Im Quellcode ruft sie **nichts** auf; sie ist ein Rest des am 02.06. entfernten Eltern-Einwilligungs-Flows (`20260602120000_remove_consent_and_explore.sql`). Solange sie steht, ist Resend ein Empfänger, der in keiner Erklärung auftaucht — und sie bricht `npx tsc --noEmit` | `list_edge_functions`, `supabase/functions/send-consent-email/` (nicht versioniert) |
| D | **`get_party_pools_by_invite_code` ist für `anon` freigegeben.** Die Oberfläche zeigt Umfragen nur Angemeldeten (`InviteScreen.tsx:602`), die RPC beantwortet sie aber jedem, der den Code hat. `get_event_attendees_by_invite_code` ist demgegenüber korrekt auf `authenticated` beschränkt | `has_function_privilege` über `pg_proc` |

### Beantwortete offene Punkte

| # | Punkt | Ergebnis |
|---|---|---|
| 5 | Photon-Standort | **Geklärt: Deutschland.** `photon.komoot.io` löst auf `116.202.51.114` auf, laut RIPE `Hetzner Online GmbH`, `country: DE`. Keine Drittlandübermittlung |
| 6 | Google Maps ohne Einwilligung | **Tragfähig auf Art. 6 Abs. 1 lit. f.** Ein HEAD auf die Static-Maps-URL antwortet mit `200`, `content-type: image/png` und **keinem** `Set-Cookie`. Es wird nichts auf dem Endgerät gespeichert oder gelesen, § 25 Abs. 1 TDDDG ist damit nicht einschlägig. Der Generator-Warnkasten von eRecht24 zielt auf die JS-Einbettung, nicht auf ein Bild. Die risikofreie Variante bliebe Klick-zum-Laden |
| 3 | Drittlandmechanismen | Gelesen in den DPAs: **Google** und **Cloudflare** sind DPF-zertifiziert (Cloudflare zusätzlich SCC), **Supabase** und **Vercel** stützen sich ausschließlich auf **Standardvertragsklauseln** — im Text entsprechend getrennt. Die Unterauftragsverarbeiter-Liste von Supabase liegt nur als PDF vor und bleibt zu prüfen |
| 7 | Log-Fristen | Supabase protokolliert je Anfrage `cf-connecting-ip`, `cf-ipcountry`, `user-agent`, `referer`; die Aufbewahrung hängt am Tarif, im kostenlosen ist sie die kürzeste. **Automatische Backups gibt es im Free-Tarif nicht** — das stützt die Zusage „sofort und vollständig gelöscht" |

### Weiteres zur Kenntnis

- `auth.users` speichert E-Mail, Passwort-Hash, `last_sign_in_at`, `confirmed_at` und die Anmeldeart. `auth.audit_log_entries` ist derzeit **leer**.
- `profiles` ist per RLS nur für den eigenen Account lesbar. Fremde Namen kommen ausschließlich über die `SECURITY DEFINER`-RPCs, jeweils auf eine Party geschlüsselt.
- Kein Treffer für Analytics, Tracking, Error-Tracking, `headers()`, `x-forwarded-for`, `user-agent` oder `navigator.geolocation` im eigenen Code — der Stand von 23.08. gilt unverändert.

### Erledigt und entschieden, 26.08.2026 (Arthur)

| Punkt | Stand |
|---|---|
| Fund C — `send-consent-email` | **BEHOBEN.** Remote gelöscht (`supabase functions delete send-consent-email`, Antwort `Deleted Edge Function`, `list_edge_functions` liefert jetzt `[]`), lokaler Ordner `supabase/functions/` entfernt. Damit ist auch der Type-Check-Blocker weg: der Build kam vorher nicht an `tsconfig`s `include: ["**/*.ts"]` vorbei, weil die Deno-Datei `Deno` und den `https://`-Import nicht auflösen konnte |
| Offener Punkt 4 — Hoster | **Entschieden: Vercel.** Damit steht der Hoster im Text nicht mehr unter Vorbehalt. Der AV-Vertrag mit Vercel läuft über deren DPA, ausschließlich auf Standardvertragsklauseln — **keine** DPF-Zertifizierung, geprüft in `vercel.com/legal/dpa` |
| Mailversand | **Resend ist gesetzt** — für die Anmelde-Mails (Custom SMTP) **und** später für eigene Benachrichtigungen. Auf Arthurs Entscheidung steht Resend bereits in der Erklärung, obwohl noch Supabase versendet; Abschnitt 7 nennt deshalb beide Wege in einem Satz. Betreiber ist **Plus Five Five, Inc.**, 2261 Market Street #5039, San Francisco, CA 94114, USA — DPF-zertifiziert laut eigener DPA, Abschnitt 11.1, zusätzlich SCC. Unterauftragsverarbeiter unter `resend.com/legal/subprocessors`, 14 Tage Vorlauf bei Änderungen |

**Neu offen:** Der Build scheitert weiterhin, aber an einer anderen Stelle — `Export encountered an error on /_global-error/page`, `TypeError: Cannot read properties of null (reading 'useContext')`. Gegengeprüft mit `git stash` auf die vorige Fassung der Datenschutz-Seite: **derselbe Fehler**, der Fund hängt also nicht an den Rechtstexten. React 19.2.4 und react-dom 19.2.4 stimmen überein, es gibt keine doppelte React-Kopie in `node_modules`. Muss vor dem ersten Deploy auf Vercel geklärt werden.

**Weiterhin offen aus dem Nachtrag:** Fund A (beide Bild-Buckets sind für jeden angemeldeten Account auflistbar), Fund D (`get_party_pools_by_invite_code` ist für `anon` freigegeben), AV-Vertrag mit Supabase bestätigen.

**Erledigt am 26.08.2026:** Der Widerspruch zwischen § 4 der Nutzungsbedingungen und der Datenschutzerklärung zur Gästeliste ist weg — die Nutzungsbedingungen sind gegen den Code neu geschrieben worden (23 statt 12 Abschnitte, `app/nutzungsbedingungen/page.tsx`). § 5 sagt jetzt, was `get_event_attendees_by_invite_code` tatsächlich tut: ohne Konto keine Gästeliste. Dazu kamen Vertragsschluss und Widerrufsrecht, die Elternzustimmung bei 16- bis 17-Jährigen, Melde- und Abhilfeverfahren nach Art. 11, 12, 16 und 17 DSA, Gästezahl und Rauswurf, die Sichtbarkeit von Umfrageantworten, der Umgang mit fremden Gästedaten, die öffentlich abrufbaren Bilder, das fehlende Backup und die Freistellung.

Fund A und Fund D wirken in den neuen Text hinein: Solange beide offen sind, verspricht § 11 nur, dass ein Bild abrufbar ist, wer seine Adresse kennt, und kein Abschnitt behauptet, Umfragen seien ohne Konto unsichtbar. Werden die Policies enger gezogen, kann der Text nachziehen — nicht umgekehrt.

### Auftragsverarbeitung — Stand nach der Überarbeitung vom 26.08.2026

Die Erklärung nennt jetzt für jeden Dienst, in welcher Rolle er steht. Das ist keine
Formsache: Ein AVV setzt voraus, dass der Dienst **auf unsere Weisung** verarbeitet.

| Dienst | Rolle | Was in der Erklärung steht | Was du dafür haben musst |
|---|---|---|---|
| Supabase | Auftragsverarbeiter | AVV nach Art. 28 DSGVO | DPA im Dashboard bestätigen/akzeptieren |
| Vercel | Auftragsverarbeiter | AVV nach Art. 28 DSGVO | Vercel-DPA akzeptieren (`vercel.com/legal/dpa`) |
| Resend | Auftragsverarbeiter | AVV nach Art. 28 DSGVO | Resend-DPA akzeptieren, sobald das Konto steht |
| Cloudflare | **Unter**auftragsverarbeiter von Supabase | Art. 28 Abs. 2 und 4 — **kein** eigener Vertrag | Cloudflare auf der Unterauftragsverarbeiter-Liste von Supabase bestätigen |
| Google (Maps, Sign-In), komoot | **Eigene Verantwortliche** | ausdrücklich kein Art.-28-Vertrag | nichts — aber die Rolle muss so bleiben, sonst ändert sich der Text |

**Wichtig:** Ein AVV mit Cloudflare wäre sachlich falsch gewesen — wir sind dort nicht
Kunde. Cloudflare kommt ausschließlich deshalb ins Spiel, weil Supabase es selbst vor
seine API setzt. Die Erklärung sagt das jetzt genau so.
