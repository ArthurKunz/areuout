// Nachpruefung freigegebener Agent-Events (Agent-Schritt 6; Vault: Party Agent, Abschnitt 6
// Schritt 11, 7 und 8 "Review" und "Cancellation").
//
// Jeder Kategorie-Aufruf prueft vor der Suche die freigegebenen, nicht abgesagten,
// kommenden Events seines Typs (`other` laeuft mit `club`). Pro Event: Quellseite im Code
// abrufen (robots.txt wie bei neuen Events), ein kurzer Claude-Aufruf ohne Werkzeuge zieht
// die aktuellen Fakten heraus, und der Code prueft sie gegen die Seite. Vorschlaege nur fuer
// Datum, Beginn, Ende, Ort, Preis und Absage; Beschreibung und Wortlaut werden nie
// verglichen. Ein Vorschlag geht als private.agent_candidates (kind 'change' oder 'cancel')
// an Arthur; live geht er erst mit approve_agent_proposal.

import type postgres from 'npm:postgres@3.4.5'
import { askClaude, type Usage } from './claude.ts'
import { distanceMeters, NEAR_METERS } from './dedupe.ts'
import { geocode } from './geo.ts'
import { berlinToDate } from './prompt.ts'
import { dateVariants, priceOnPage, readPage, type RobotsCache, wordsMatch } from './verify.ts'

const PARALLEL = 5
// Die Suche danach braucht den Rest des Zeitbudgets.
const BUDGET_MS = 60_000
// Genug fuer jede Veranstaltungsseite, haelt den Aufruf klein.
const PAGE_CHARS = 40_000
// Eine Absage muss so auf der Seite stehen, nicht nur in Claudes Antwort.
const CANCELLED = /abgesagt|entfällt|entfaellt|fällt aus|faellt aus|findet nicht statt|cancelled|canceled/

type Approved = {
  id: string
  title: string
  event_date: Date
  ends_at: Date | null
  location: string
  lat: number
  lng: number
  price: string | null
  description: string
  background_url: string
  source_url: string
  starts_on: string
  event_type: string
}

type Facts = {
  found: boolean
  cancelled: boolean
  date: string | null
  start_time: string | null
  end_time: string | null
  venue: string | null
  address: string | null
  price_eur: number | null
}

type Proposal = { kind: 'change' | 'cancel'; changes: Record<string, unknown> | null }

export type RecheckResult = { rechecked: number; proposals: number }

const day = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
const time = (d: Date) => d.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

function prompt(ev: Approved, text: string): string {
  return `Below is the text of a web page (lowercased) and the facts we stored for one event listed on it.
Report the event's CURRENT facts as stated on the page.

Stored facts:
- name: ${ev.title}
- date: ${day(ev.event_date)}
- start_time: ${time(ev.event_date)}
- end_time: ${ev.ends_at ? time(ev.ends_at) : 'null'}
- place: ${ev.location}
- price_eur: ${ev.price ?? 'null'}

Rules:
- Only use what the page states. Never guess. A value the page does not state is null.
- If the page lists several dates of a recurring series, report the date that belongs to the stored event. Keep the stored date if it is still listed.
- "cancelled": true only if the page says this event is cancelled ("abgesagt", "entfällt", "fällt aus"). A postponement is a new date, not a cancellation.
- "found": false if the event is not on the page at all.
- price_eur: the box office price, or the lowest stated price. 0 only if the page says the event is free.

Answer with ONLY a JSON code block in exactly this shape:
\`\`\`json
{"found": true, "cancelled": false, "date": "YYYY-MM-DD or null", "start_time": "HH:MM or null", "end_time": "HH:MM or null", "venue": "string or null", "address": "string or null", "price_eur": "number or null"}
\`\`\`

Page text:
${text.slice(0, PAGE_CHARS)}`
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() && v.trim() !== 'null' ? v.trim() : null)

function parseFacts(answer: string): Facts | null {
  const fenced = answer.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1] : answer.slice(answer.indexOf('{'), answer.lastIndexOf('}') + 1)
  try {
    const o: Record<string, unknown> = JSON.parse(raw)
    const hhmm = (v: unknown) => {
      const s = str(v)
      return s && /^\d{1,2}:\d{2}$/.test(s) ? s.padStart(5, '0') : null
    }
    const date = str(o.date)
    return {
      found: o.found !== false,
      cancelled: o.cancelled === true,
      date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
      start_time: hhmm(o.start_time),
      end_time: hhmm(o.end_time),
      venue: str(o.venue),
      address: str(o.address),
      price_eur: typeof o.price_eur === 'number' && Number.isFinite(o.price_eur) && o.price_eur >= 0 ? o.price_eur : null,
    }
  } catch {
    return null
  }
}

// Vergleicht die Fakten von Claude mit dem Event. null = kein Vorschlag.
async function propose(ev: Approved, f: Facts, text: string): Promise<{ proposal: Proposal; row: Record<string, unknown> } | null> {
  const base = {
    title: ev.title, starts_at: ev.event_date, ends_at: ev.ends_at, starts_on: ev.starts_on, location: ev.location,
    lat: ev.lat, lng: ev.lng, price: ev.price === null ? null : Number(ev.price),
  }
  if (f.cancelled && CANCELLED.test(text)) return { proposal: { kind: 'cancel', changes: null }, row: base }

  const changes: Record<string, unknown> = {}
  const next = { ...base }
  const today = day(new Date())

  // Datum und Beginn. Ein neues Datum muss auf der Seite stehen und darf nicht vorbei sein.
  const newDay = f.date && f.date !== ev.starts_on && f.date >= today && dateVariants(f.date).some((v) => text.includes(v)) ? f.date : ev.starts_on
  const startTime = f.start_time ?? time(ev.event_date)
  const startsAt = berlinToDate(newDay, startTime)
  if (startsAt.getTime() !== ev.event_date.getTime() && startsAt > new Date()) {
    next.starts_at = startsAt
    next.starts_on = newDay
    changes.starts_at = startsAt.toISOString()
  }

  // Ende: von der Seite, sonst wandert ein bekanntes Ende mit dem Beginn mit. Fehlt es auf
  // der Seite, bleibt es (nie raten, nie loeschen).
  let endsAt: Date | null = ev.ends_at
  if (f.end_time) endsAt = berlinToDate(next.starts_on, f.end_time)
  else if (ev.ends_at && changes.starts_at) endsAt = new Date(ev.ends_at.getTime() + (startsAt.getTime() - ev.event_date.getTime()))
  if (endsAt && endsAt <= next.starts_at) endsAt = new Date(endsAt.getTime() + 24 * 3600_000)
  if (endsAt && endsAt.getTime() !== ev.ends_at?.getTime()) {
    next.ends_at = endsAt
    changes.ends_at = endsAt.toISOString()
  }

  // Ort: muss auf der Seite stehen und mehr als 100 m vom bisherigen entfernt sein.
  if ((f.venue || f.address) && (wordsMatch(f.venue, text, 0.5) || wordsMatch(f.address, text, 0.5))) {
    const place = await geocode(f.venue, f.address, 'Leipzig').catch(() => null)
    if (place && distanceMeters(place, ev) > NEAR_METERS) {
      const location = [f.venue, f.address].filter(Boolean).join(', ').slice(0, 500) || place.label
      Object.assign(next, { location, lat: place.lat, lng: place.lng })
      changes.location = location
    }
  }

  // Preis: nur ein Preis, der auf der Seite steht. Eintritt frei heisst: kein Preis.
  if (f.price_eur !== null && f.price_eur <= 9999.99 && priceOnPage(f.price_eur, text) === true) {
    const price = f.price_eur === 0 ? null : f.price_eur
    if (price !== base.price) {
      next.price = price
      changes.price = price
    }
  }

  return Object.keys(changes).length ? { proposal: { kind: 'change', changes }, row: next } : null
}

// Gleich, wenn dieselben Felder auf dieselben Werte zeigen (jsonb sortiert die Schluessel um).
function sameChanges(a: Record<string, unknown> | null, b: Record<string, unknown> | null): boolean {
  const norm = (o: Record<string, unknown> | null) =>
    JSON.stringify(Object.keys(o ?? {}).sort().map((k) => {
      const v = o![k]
      return [k, typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v).getTime() : v === null ? null : typeof v === 'string' ? v : Number(v)]
    }))
  return norm(a) === norm(b)
}

export async function recheckEvents(
  sql: postgres.Sql,
  category: string,
  runId: string,
  usage: Usage,
  reasons: Record<string, number>,
): Promise<RecheckResult> {
  const started = Date.now()
  const result: RecheckResult = { rechecked: 0, proposals: 0 }
  const skip = (reason: string) => {
    const key = `Nachpruefung: ${reason}`
    reasons[key] = (reasons[key] ?? 0) + 1
  }

  const events = await sql<Approved[]>`
    select e.id, e.title, e.event_date, e.ends_at, e.location, e.lat, e.lng, e.price::text as price,
           e.description, e.background_url, d.source_url, d.starts_on::text as starts_on, c.event_type
    from public.events e
    join public.agent_event_details d on d.event_id = e.id
    join private.agent_candidates c on c.event_id = e.id and c.kind = 'new' and c.status = 'approved'
    where e.host_id = private.agent_system_account()
      and d.cancelled_at is null
      and e.event_date > now()
      and (c.event_type = ${category} or (${category} = 'club' and c.event_type = 'other'))
    order by e.event_date`
  if (!events.length) return result

  // Offene und verworfene Vorschlaege: dasselbe nicht noch einmal vorschlagen.
  const earlier = await sql<{ id: string; event_id: string; kind: string; status: string; changes: Record<string, unknown> | null }[]>`
    select id, event_id, kind, status, changes from private.agent_candidates
    where kind in ('change', 'cancel') and status in ('draft', 'discarded')
      and event_id in ${sql(events.map((e) => e.id))}`

  const robots: RobotsCache = new Map()
  for (let i = 0; i < events.length; i += PARALLEL) {
    if (Date.now() - started > BUDGET_MS) {
      for (let j = i; j < events.length; j++) skip('Zeitbudget erreicht')
      break
    }
    await Promise.all(
      events.slice(i, i + PARALLEL).map(async (ev) => {
        try {
          const page = await readPage(new URL(ev.source_url), robots)
          if (!page.ok) return skip(page.reason)
          const facts = parseFacts(await askClaude(prompt(ev, page.text), usage))
          await sql`update public.agent_event_details set last_checked_at = now() where event_id = ${ev.id}`
          result.rechecked++
          if (!facts) return skip('Antwort nicht lesbar')
          if (!facts.found) return skip('Event nicht mehr auf der Seite')

          const found = await propose(ev, facts, page.text)
          if (!found) return
          const { proposal, row } = found
          const mine = earlier.filter((p) => p.event_id === ev.id && p.kind === proposal.kind)
          if (mine.some((p) => sameChanges(p.changes, proposal.changes))) return
          // Ein anderer offener Vorschlag derselben Art ist ueberholt.
          const stale = mine.filter((p) => p.status === 'draft').map((p) => p.id)
          if (stale.length) {
            await sql`update private.agent_candidates set status = 'expired', decided_at = now() where id in ${sql(stale)}`
          }
          await sql`
            insert into private.agent_candidates (
              kind, event_id, run_id, title, starts_at, ends_at, starts_on, location, lat, lng, event_type,
              price, source_url, description, background_url, changes
            ) values (
              ${proposal.kind}, ${ev.id}, ${runId}, ${row.title as string}, ${row.starts_at as Date}, ${row.ends_at as Date | null},
              ${row.starts_on as string}::date, ${row.location as string}, ${row.lat as number}, ${row.lng as number}, ${ev.event_type},
              ${row.price as number | null}, ${ev.source_url}, ${ev.description}, ${ev.background_url},
              ${proposal.changes ? sql.json(proposal.changes as postgres.JSONValue) : null}
            )`
          result.proposals++
        } catch (err) {
          skip(`Fehler: ${err instanceof Error ? err.message : String(err)}`.slice(0, 200))
        }
      }),
    )
  }
  return result
}
