# Datenschutz-Bestandsaufnahme — Student Connect

Erhoben am 23.08.2026 gegen den Stand `f74925d`, nachgetragen nach den Umbauten vom
selben Tag. Was inzwischen behoben ist, steht als **BEHOBEN** dabei. Grundlage für Impressum und
Datenschutzerklärung nach DSGVO, Standort Deutschland.

Jede Aussage ist mit Datei und Zeile belegt oder empirisch geprüft. Was sich aus dem
Repository nicht feststellen ließ, steht als **UNKLAR – manuell prüfen** und ist unten
in „Offene Punkte" gesammelt. Nichts davon ist geraten.

**Das ist eine technische Bestandsaufnahme, keine Rechtsberatung.**

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
| `photon.komoot.io` | Adress-Vorschläge (JSON) | **Bei jedem Tastendruck** in der Adresssuche, nicht erst beim Absenden | `features/parties/components/AddressSearchField.tsx:118–119` |
| `www.google.com` | Nichts — reines Linkziel | Nur wenn der Nutzer die Karte antippt | `features/parties/components/PartyMap.tsx:11` |

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
| `invite_code` | text | Nein — aber das einzige Zugangsgeheimnis der Party |
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
| **Supabase** | **UNKLAR – manuell prüfen** | Die Region steht nicht im Repository. Aus der API nicht ablesbar: die Domain löst auf Cloudflare-IPs auf (`172.64.149.246`, `104.18.38.10`), der Header nennt nur den Cloudflare-Randknoten. **Im Supabase-Dashboard unter Settings → General nachsehen.** Bei einer EU-Region (z. B. `eu-central-1`) liegt die Datenbank in der EU; das US-Mutterunternehmen bleibt davon unberührt |
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
| 1 | **Supabase-Region** — EU oder nicht? Entscheidet, ob eine Drittlandübermittlung für die Kerndaten vorliegt | Supabase-Dashboard → Settings → General |
| 2 | **AV-Vertrag mit Supabase** abschließen oder bestätigen | Supabase-Dashboard → Settings → Legal / Compliance |
| 3 | **Cloudflare in die Erklärung aufnehmen** — steht nirgends im Code, ist aber an jeder Abfrage beteiligt. Klären, ob der Supabase-AV-Vertrag Cloudflare als Unterauftragsverarbeiter abdeckt | Unterauftragsverarbeiter-Liste von Supabase |
| 4 | **Hoster festlegen** und AV-Vertrag schließen. Vercel ist bisher nur vorbereitet, nicht gewählt | — |
| 5 | **Photon / komoot**: Betriebsstandort und Rechtsgrundlage klären. Alternativ überlegen, ob die Suche erst ab z. B. drei Zeichen auslöst — derzeit geht **jeder Tastendruck** an komoot | `features/parties/components/AddressSearchField.tsx:118–119` |
| 6 | **Google Maps**: Der Kartenabruf passiert ungefragt beim Öffnen der Party-Seite. Prüfen lassen, ob das ohne Einwilligung tragfähig ist, oder die Karte erst nach Klick laden | `features/parties/components/PartyMap.tsx:10` |
| 7 | **Log-Fristen** von Supabase, Cloudflare und Hoster erfragen und in die Erklärung schreiben | Tarif-Dokumentation der Anbieter |
| 8 | **Anschrift und Kontakt-E-Mail** in Impressum, Datenschutz und Nutzungsbedingungen eintragen — dort als `«...»` markiert | `app/impressum/page.tsx`, `app/datenschutz/page.tsx`, `app/nutzungsbedingungen/page.tsx` |

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
| Analytics, Tracking, Payment | Nicht vorhanden |
| localStorage | Wird nicht genutzt |
| Anonyme Besucher | Bekommen keine Cookies |
| Löschkaskade | Lückenlos, geprüft. Ein verwaistes Avatar eines gelöschten Kontos wurde am 23.08. entfernt |
| Auflisten der Buckets | Gesperrt, geprüft |
| EXIF/GPS in neuen Uploads | Wird entfernt, geprüft |
| Kein Geburtsdatum, Geschlecht, Telefonnummer, Gerätestandort | Wird nicht erhoben — als Datensparsamkeit erwähnenswert |
