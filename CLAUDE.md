@AGENTS.md

# CLAUDE.md

This is a party and event discovery app for people aged 16–26.
Read this entire file before writing any code.

---

## Project summary
A web app where hosts create public or private events and guests
discover and RSVP to them. Two user roles: host and guest.
Current phase: V1 MVP. Deadline: July 2026.

Run by Arthur as a **private individual** — no registered business
(kein Gewerbe), no intention to earn money from it. Never suggest ads,
paid tiers, payment providers, affiliate links or any other monetisation,
and never propose a paid plan of a third-party service: Supabase, Vercel
and Google Maps have to stay inside their free tiers. If a change would
push past a free-tier limit, say so before writing it. The legal
consequences are written up in RECHTLICHES-BESTANDSAUFNAHME.md, section 0.

## Problem statement
For students and young people aged 16–26, finding out what's
happening socially still depends on being in the right WhatsApp
group or following the right person on Instagram. If you're new
to a city or university, events are invisible to you and you're
invisible to them. Facebook Events has discovery but is abandoned
by this generation. Hosts have no dedicated tool to manage
attendance or build credibility — it all gets lost across group
chats and stories.

## Tech stack
- Framework: Next.js 14, App Router only
- Language: TypeScript strict mode
- Database: Supabase (Postgres)
- Auth: Supabase Auth via @supabase/ssr
- Styling: Tailwind CSS

## Coding rules
- Always use my global.css variables. Never use things like bg-green-500 or bg-[#fff], but always use the variables. If there are no matching variables, ask me for permisson to create those.
- Hairline dividers have their own two variables: `bg-divider` inside the glass ••• panel, `bg-divider-subtle` on the black page. Never write the hex again
- Icons: ONLY `lucide-react`. Never hand-roll an `<svg>` for an icon — no inline paths for chevrons, arrows, plus, close, etc. If lucide has no matching icon, ask me before drawing one. (The two deliberate exceptions are a brand mark lucide dropped — the Google logo on the auth sheet — and genuine illustration, not iconography.)
- The only other symbols allowed are Apple emojis (the native system emoji, e.g. 👤 🎂 📸 🤫 ⚖️). Emoji for flavour and list bullets, lucide for interface icons — never a drawn substitute for either.
- update the CLAUDE.md file after each change yourself — but never add a "Current state" section, and never reintroduce one
- Never use `any` type
- Der Bildwähler für Party-Hintergründe ist eine Komponente, kein Codeblock:
  `features/parties/components/BackgroundPicker.tsx`, mit den Regeln in
  `features/parties/constants/background.constants.ts` (Bucket, 10 MB, die acht Motive).
  Erstellen und Bearbeiten benutzen dieselbe. Hochgeladene Hintergründe tragen einen
  Zeitstempel im Namen — `{host}/{party}/background-{ms}.jpg` — aus demselben Grund wie
  die Avatare: ein fester Name wäre dieselbe URL, und der Zwischenspeicher lieferte nach
  einem Wechsel stundenlang das alte Bild aus
- Never nest `backdrop-blur` inside an element that already blurs: the inner one re-samples the already tinted backdrop and paints a visible darker pill behind the row. Inside a glass panel, rows carry a background colour or nothing at all
- Always ask for my permission to commit or add something
- call me 'Arthur' every time you respond
- Always give me a summary of all changes at the end of all responses
- Always use App Router patterns — never Pages Router
- Default to server components, use `use client` only when needed
- Use createServerClient in server components and API routes
- Use createBrowserClient in client components
- Write RLS policies for every table — never skip this
- A column with a fixed set of values needs a CHECK constraint. RLS decides WHO may write a row, never WHAT is in it, and the anon key sits in the browser bundle — so any value the UI does not offer can still be written by hand
- Every text column is length-capped and every structured one format-checked in the
  database as of 21.08.2026 — see the CHECK table in SCHEMA.md. When you add a column,
  add its constraint in the same migration. Keep the bound roughly ten times the UI's
  own limit: it exists to stop a megabyte of text, not to enforce the form twice
- RLS cannot serialise. A policy is an expression Postgres evaluates — it cannot take a
  lock and knows nothing about the other transactions doing the same thing at the same
  moment. Anything that has to hold across concurrent writers (a capacity, a quota, a
  "only one of these may exist") needs a BEFORE trigger that locks first, not a cleverer
  policy. `rsvps_enforce_capacity` is the worked example
- An RLS SELECT policy has to be satisfiable from the row's own columns. `.insert(...).select(...)` becomes `INSERT ... RETURNING`, which Postgres checks against the SELECT policy while the new row is still invisible to any function that looks it up again
- Never fetch a list by looping one request per row. Every screen that shows many
  parties reads them through the `_for_events(uuid[])` RPCs, which take an array of ids
  and answer in one round trip. A per-party loop turns ten parties into twenty network
  hops, and on a phone that is the whole loading experience
- A party that is over is still readable — the row stays, the invite link keeps working
  — but it must never look upcoming. `isPartyOver` decides; InviteScreen and
  PartyDetailScreen both hide the RSVP controls and the address once it is true.
  Seit dem 27.08.2026 ist das nicht mehr nur Oberfläche: `get_party_by_invite_code`
  liefert `location` dann als leeren String aus — ausser an den Gastgeber, der seine
  eigene vergangene Party vollständig sieht. Die Sechs-Stunden-Annahme steckt damit an
  ZWEI Stellen (ASSUMED_PARTY_HOURS in lib/utils.ts und `c_assumed_hours` in der
  Migration); ändert sich die eine, muss die andere mit. Leerer String und nicht NULL,
  weil beide Screens `party.location.lastIndexOf(',')` unbedingt aufrufen
- PostgREST embeds resolve by the real table name, not by the app's wording: the table is `events`, so write `parties:events(...)`, never `parties(...)`
- Never expose the Supabase service role key on the client
- Generate TypeScript types regularly: supabase gen types typescript. Seit dem
  27.08.2026 tragen alle drei Clients — Browser, Server, Proxy — `<Database>` aus
  `types/database.types.ts`. Eine veraltete Typdatei ist damit kein stiller Mangel mehr,
  sondern bricht den Typecheck: nach jeder Schemaänderung neu erzeugen, im selben Commit

## commit rules
Always use this keywords:
- feat -> new feature
- fix -> bug fix
- refactor -> improve code without changing behavior
- style -> formatting/UI-only small changes
- docs -> documentation
- test -> tests
- chore -> maintenance stuff
- perf -> performance improvements
- built -> built config changes
- ci -> GitHub Actions / CI stuff
Always use this structure:
- git commit -m 'KEYWORD(FILE, CHANGES OR FEATURE): EXPLANATION OF THE COMMIT'
Always git push after commiting something

## Do not suggest these — locked out of this project
- Prisma, Firebase, PlanetScale (using Supabase)
- Clerk, NextAuth (using Supabase Auth)
- React Router, react-router-dom (using Next.js App Router)
- Redux, Zustand (use React state or Supabase realtime)
- Pages Router patterns
- Any use of `any` in TypeScript

## V1 features (in scope)
- Sign up / log in with email
- Profile: first name, last name and initials avatar
- Create event: name, description, type, date, time, optional end time, location
- Simple RSVP: coming / maybe / not coming
- Host guest list: attendee names, total headcount
- Shareable link format: /e/[invite_code] — no auth required to view basic info
- Non-users who open a link see basic info and are prompted to sign up
- Guest can click 'coming late' and provide the expected arriving time
- Location is displayed in a Map
- voting: the host asks a question, the guest answer or vote for something
- Checklist / who brings what
- click, navigation and loading animations
- Mobile responsive

## Not in V1 — do not suggest these
- Monetisation of any kind: ads, paid tiers, payment providers, affiliate
  links, sponsored events. Not in V1 and not later — see Project summary
- Explore page: all public events, because we want to prevent a cold-start
- Profile photo upload (using initials avatar instead)
- Gender field on profiles (legal complexity for under-18 users)
- Age limits or restrictions on events
- Join request or host approval flow
- Collaborative event type
- Party score or reputation system
- Discovery feed with filters
- External sharing buttons (WhatsApp, Instagram)
- Push notifications
- PWA
- Native mobile app
- AI features
- Public profile pages
- Party type tags
- A way out of onboarding ("mit anderem Konto anmelden"): the flow goes forward only

## Data model (see SCHEMA.md for full detail)
Core tables: profiles, events, rsvps, pools, pool_options, pool_responses
Key fields:
- events.invite_code: 12 random base32 symbols (Crockford ohne I, L, O, U), UNIQUE —
  the shareable link's only secret, 60 Bit. Die Zeile stand bis zum 27.08.2026 auf
  "10 random hex chars"; das war der Stand vor der Verlängerung am 23.08. Dazu bremst
  `get_party_by_invite_code` seit dem 27.08. Fehlversuche auf 30 pro IP und Minute
- rsvps.status: 'going' | 'maybe' | 'not_going', CHECK-constrained
- profiles: firstname, lastname, avatar_url, avatar_color. profiles.id IS
  auth.users.id — there is no separate auth_user_id column
- the app stores NO date of birth and no age. The 16+ minimum lives in the terms, not
  in a column and not in a sign-up question — do not reintroduce one
- no tasks table and no party_score column yet — do not write code that assumes either
- there is no role column on profiles. Host and guest are always DERIVED from a
  relationship: host from `events.host_id`, guest from a row in `rsvps`. A person is a
  host of one party and a guest at another in the same session, so a stored role would
  be wrong the moment it is written. (Kept from STORIES_V1.md, which was deleted on
  27.08.2026 — this was the one durable sentence in it)

## Folder structure
- app/ - all routes
- app/e/[invite_code]/ — event page via shareable link
- app/impressum/, app/datenschutz/, app/nutzungsbedingungen/ — the three legal texts.
  They sit at the app ROOT and not under /profile on purpose: all three have to render
  without a session, so they are listed in `PUBLIC_PATHS` and in `GATE_EXEMPT` in
  proxy.ts, and the sign-up sheet links straight to them. Do not move them behind the
  auth gate. Everything a reader has to fill in themselves is marked with «...»
  Die Datenschutzerklärung ist am 26.08.2026 gegen den Code, die Live-Datenbank und die
  Antworten der beteiligten Server neu geschrieben worden (Art.-13-Gliederung, 17
  Abschnitte). Sie behauptet nichts, was nicht belegt ist — der Kopfkommentar der Datei
  führt jede Messung mit. Kommt ein Dienst dazu, der Daten empfängt, oder ändert sich,
  wer welche Zeile sehen darf, gehört beides in Abschnitt 6 bzw. 7 dieser Datei, bevor
  der Code gemergt wird.
  Die Nutzungsbedingungen sind am 26.08.2026 auf dieselbe Weise neu geschrieben worden
  (23 Abschnitte). Neu darin: Vertragsschluss und der Grund, warum kein Widerrufsrecht
  besteht (§ 2); die Zustimmung der Eltern bei 16- bis 17-Jährigen (§ 3); Melde- und
  Abhilfeverfahren samt Begründungspflicht und Kontaktstelle nach Art. 11, 12, 16 und 17
  DSA (§§ 13, 14); Gästezahl, Rauswurf durch den Gastgeber, Sichtbarkeit der
  Umfrageantworten, der Umgang mit den Daten anderer Gäste, die öffentlich abrufbaren
  Bilder, das Fehlen jeder Datensicherung und die Freistellung. Jede Aussage über die App
  hat eine Belegstelle im Kopfkommentar der Datei — ändert sich das Verhalten, ändert sich
  der Satz mit. Was der Code nicht hält, wird dort nicht versprochen: die Buckets sind
  öffentlich, also sagt § 11 nur, dass ein Bild abrufbar ist, wer seine Adresse kennt —
  und genau so bleibt es, bis die Bilder in private Buckets mit signierten URLs ziehen.
  (Zwei Vorbehalte sind am 27.08.2026 entfallen: `get_party_pools_by_invite_code` ist
  für `anon` gesperrt, und die SELECT-Policies der Buckets erlauben nur noch den
  eigenen Ordner — auflisten kann fremde Bilder seither niemand mehr.)
- components/ — shared UI components
- lib/ — Supabase client setup and utility functions
- types/ — generated Supabase types and custom types
- features/ - all big parts of the web app like login or explore

## Environment variables
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_GOOGLE_MAPS_KEY
- NEXT_PUBLIC_SITE_URL — the own domain, once there is one. Everything that needs an
  absolute address (Open Graph previews, robots.txt, sitemap.xml) reads it through
  `siteUrl()` in lib/site.ts, which falls back to Vercel's own production URL and then
  to localhost. Never write a domain into a file. `siteUrl()` ergänzt seit dem
  27.08.2026 ein fehlendes `https://` selbst und verwirft einen Wert, den `new URL`
  nicht lesen kann: der Rückgabewert landet in app/layout.tsx auf Modulebene in
  `new URL(siteUrl())`, und ein von Hand getipptes `areuout.de` hätte dort den Build
  beim Prerendern abgebrochen — an genau dem Tag, an dem die Variable zum ersten Mal
  gesetzt wird
- SUPABASE_SERVICE_ROLE_KEY (server only — never import on client). Currently used
  nowhere in the source, so it does not belong in the deployment either
Never hardcode these. Always read from process.env. `.env.example` is the copy
template and the only .env file that is versioned.

---

## Behavioral guidelines
These apply on top of all project-specific rules above.
**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### If you can choose from using "" or '' just the latter
Don't ask. Don't overthink, but doublecheck if you can really use '' instead of ""

### Think before coding
Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### Simplicity first
Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### Surgical changes
Touch only what you must. Clean up only your own mess.

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

### Goal-driven execution
Define success criteria. Loop until verified.

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.