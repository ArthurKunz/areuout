// Party-Agent (Agent-Schritt 3): sucht fuer EINE Kategorie oeffentliche Musik- und
// Party-Events in Leipzig und im Landkreis fuer die naechsten 14 Tage, prueft jedes gegen
// seine Quellseite und legt Entwuerfe an, die Arthur spaeter einzeln freigibt
// (Vault: Party Agent, Abschnitte 6 bis 9; Party Agent Build Order, Schritt 3).
//
// Aufruf: POST {"category": "club" | "concert" | "festival" | "open_air"} mit dem Header
// x-agent-secret = Secret AGENT_SECRET. verify_jwt ist aus, wie bei send-push und
// report-email: spaeter ruft pg_cron ueber pg_net auf, ohne JWT. Eine Kategorie pro Aufruf,
// damit ein Lauf sicher unter dem Zeitlimit der Edge Functions bleibt.
//
// Schreibt nur private.agent_candidates (Entwuerfe) und private.agent_runs (eine Zeile pro
// Aufruf), nie public.events. Das private Schema ist fuer die API-Rollen gesperrt, auch fuer
// service_role. Deshalb geht die Funktion direkt ueber SUPABASE_DB_URL in die Datenbank
// (SCHEMA.md 9f). Jeder Fehler landet als Text in der Lauf-Zeile.

import { timingSafeEqual } from 'jsr:@std/crypto@1/timing-safe-equal'
import postgres from 'npm:postgres@3.4.5'
import { emptyUsage, MODEL, runClaude } from './claude.ts'
import { sameEvent, type Slot } from './dedupe.ts'
import { geocode, geoProblem } from './geo.ts'
import { berlinToDate, buildPrompt, CATEGORIES, EVENT_TYPES, type EventType, type FoundEvent, parseEvents, toFoundEvent, windowDates } from './prompt.ts'
import { checkEvent, type RobotsCache } from './verify.ts'

const MAX_EVENTS = 60
const PARALLEL_CHECKS = 5
// Zeitbudget fuer den ganzen Aufruf. Das harte Limit der Plattform liegt darueber.
const BUDGET_MS = 300_000
const TITLE_MAX = 60
const DESCRIPTION_MAX = 500
const FREE = 'Eintritt frei.'

const encoder = new TextEncoder()

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// timingSafeEqual wirft bei ungleicher Laenge. Beide Seiten erst hashen: immer 32 Bytes.
async function hasSecret(req: Request): Promise<boolean> {
  const expected = Deno.env.get('AGENT_SECRET')
  const given = req.headers.get('x-agent-secret')
  if (!expected || !given) return false
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(given)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  return timingSafeEqual(a, b)
}

function cut(text: string, max: number): string {
  if (text.length <= max) return text
  const head = text.slice(0, max - 1)
  const space = head.lastIndexOf(' ')
  return `${(space > max / 2 ? head.slice(0, space) : head).trimEnd()}…`
}

function description(ev: FoundEvent, free: boolean): string {
  if (!free || /eintritt frei/i.test(ev.description_de)) return cut(ev.description_de, DESCRIPTION_MAX)
  return `${cut(ev.description_de, DESCRIPTION_MAX - FREE.length - 1)} ${FREE}`
}

const validWebsite = (url: string | null) =>
  url && /^https:\/\/\S+$/.test(url) && url.length <= 500 ? url : null

Deno.serve(async (req) => {
  if (req.method !== 'POST' || !(await hasSecret(req))) return new Response('Forbidden', { status: 403 })

  const body: unknown = await req.json().catch(() => null)
  const id = body && typeof body === 'object' && 'category' in body ? body.category : null
  const category = CATEGORIES.find((c) => c.id === id)
  if (!category) return json(400, { error: 'category muss club, concert, festival oder open_air sein' })

  const started = Date.now()
  const window = windowDates()
  const sql = postgres(Deno.env.get('SUPABASE_DB_URL') ?? '', { prepare: false, max: 2 })
  const counts = { found: 0, verified: 0, discarded: 0, duplicates: 0, drafts: 0 }
  const reasons: Record<string, number> = {}
  const discard = (reason: string) => {
    counts.discarded++
    reasons[reason] = (reasons[reason] ?? 0) + 1
  }
  const usage = emptyUsage()
  let error: string | null = null

  const [run] = await sql<{ id: string }[]>`
    insert into private.agent_runs (category, model) values (${category.id}, ${MODEL}) returning id`

  try {
    // Alles Noetige vorher laden. Fehlt etwas, scheitert der Lauf, bevor Claude Geld kostet.
    const [{ system_id: systemId }] = await sql<{ system_id: string | null }[]>`
      select private.agent_system_account() as system_id`
    if (!systemId) throw new Error('Systemaccount fehlt in private.agent_config')

    const photoRows = await sql<{ name: string }[]>`
      select name from storage.objects
      where bucket_id = 'event-backgrounds' and name like ${systemId + '/%'} and name ~* '\\.(jpe?g|png|webp)$'`
    const photos = new Map<string, string[]>()
    for (const { name } of photoRows) {
      const type = name.split('/')[1]
      photos.set(type, [...(photos.get(type) ?? []), name])
    }
    if (!photos.get(category.id)?.length) throw new Error(`Keine Stockfotos unter ${systemId}/${category.id}/`)

    const blocked = new Set(
      (await sql<{ source_url: string }[]>`select source_url from private.agent_blocked_sources`).map((r) => r.source_url),
    )
    // Sicheres Duplikat: derselbe Link am selben Tag, egal ob Entwurf, freigegeben, verworfen
    // oder abgelaufen (ein verworfener Entwurf kommt nicht wieder) oder schon veroeffentlicht.
    const known = new Set(
      (
        await sql<{ key: string }[]>`
          select source_url || '|' || starts_on as key from private.agent_candidates
          where kind = 'new' and starts_on >= ${window.start}::date
          union
          select source_url || '|' || starts_on from public.agent_event_details
          where starts_on >= ${window.start}::date`
      ).map((r) => r.key),
    )
    const drafts: (Slot & { day: string })[] = (
      await sql<{ title: string; starts_at: Date; ends_at: Date | null; lat: number; lng: number; day: string }[]>`
        select title, starts_at, ends_at, lat, lng, starts_on::text as day from private.agent_candidates
        where kind = 'new' and status = 'draft' and starts_on between ${window.start}::date and ${window.end}::date`
    ).map((r) => ({ title: r.title, startsAt: r.starts_at, endsAt: r.ends_at, lat: r.lat, lng: r.lng, day: r.day }))
    // Alle kommenden oeffentlichen Partys, von Nutzern und vom Agenten.
    const parties = (
      await sql<{ id: string; title: string; event_date: Date; ends_at: Date | null; lat: number; lng: number; day: string }[]>`
        select id, title, event_date, ends_at, lat, lng, (event_date at time zone 'Europe/Berlin')::date::text as day
        from public.events
        where is_public and lat is not null and lng is not null
          and private.party_visible_until(event_date, ends_at) > now()
          and (event_date at time zone 'Europe/Berlin')::date between ${window.start}::date and ${window.end}::date`
    ).map((r) => ({ id: r.id, title: r.title, startsAt: r.event_date, endsAt: r.ends_at, lat: r.lat, lng: r.lng, day: r.day }))

    const text = await runClaude(buildPrompt(category, window), usage)
    const raw = parseEvents(text)
    if (raw === null) throw new Error('Antwort von Claude ist kein lesbares JSON')
    counts.found = raw.length

    // Billige Pruefungen zuerst, damit keine Seite unnoetig abgerufen wird.
    const queue: FoundEvent[] = []
    const seenInRun = new Set<string>()
    for (const [i, item] of raw.entries()) {
      const ev = toFoundEvent(item)
      if (i >= MAX_EVENTS) discard('mehr als 60 Events')
      else if (!ev) discard('Eintrag unvollstaendig')
      else if (!ev.start_time) discard('keine Startzeit')
      else if (ev.source_url.length > 2000) discard('source_url zu lang')
      else if (blocked.has(ev.source_url)) discard('Quelle gesperrt')
      else {
        const key = `${ev.source_url}|${ev.date}`
        if (known.has(key) || seenInRun.has(key)) counts.duplicates++
        else {
          seenInRun.add(key)
          queue.push(ev)
        }
      }
    }

    // Quellseite pruefen und geocodieren, 5 Events gleichzeitig.
    const robots: RobotsCache = new Map()
    const checked: { ev: FoundEvent; free: boolean; price: number | null; lat: number; lng: number; label: string }[] = []
    let unchecked = 0
    for (let i = 0; i < queue.length; i += PARALLEL_CHECKS) {
      if (Date.now() - started > BUDGET_MS) {
        unchecked = queue.length - i
        for (let j = 0; j < unchecked; j++) discard('Zeitbudget erreicht')
        break
      }
      const batch = queue.slice(i, i + PARALLEL_CHECKS)
      const results = await Promise.all(
        batch.map(async (ev) => {
          const check = await checkEvent(ev, window, robots)
          if (!check.ok) return { ev, reason: check.reasons[0] }
          const place = await geocode(ev.venue, ev.address, ev.city).catch(() => null)
          return { ev, check, place }
        }),
      )
      for (const r of results) {
        if (!('check' in r)) {
          discard(r.reason)
          continue
        }
        counts.verified++
        if (!r.place) {
          discard(geoProblem ? `Adresse nicht gefunden (${geoProblem})` : 'Adresse nicht gefunden')
          continue
        }
        const confirmed = r.check.priceConfirmed === true
        checked.push({
          ev: r.ev,
          free: confirmed && r.ev.price_eur === 0,
          price: confirmed && r.ev.price_eur && r.ev.price_eur <= 9999.99 ? r.ev.price_eur : null,
          ...r.place,
        })
      }
    }
    if (unchecked) error = `Zeitbudget erreicht, ${unchecked} Events nicht geprueft`

    for (const c of checked) {
      const startsAt = berlinToDate(c.ev.date, c.ev.start_time ?? '00:00')
      let endsAt = c.ev.end_time ? berlinToDate(c.ev.date, c.ev.end_time) : null
      if (endsAt && endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 24 * 3600_000)
      const title = cut(c.ev.name, TITLE_MAX)
      const slot: Slot & { day: string } = { title, startsAt, endsAt, lat: c.lat, lng: c.lng, day: c.ev.date }

      // Dasselbe Event aus einer anderen Quelle liegt schon als Entwurf vor: ueberspringen.
      // Ein Entwurf ist kein Event, duplicate_of kann nur auf Events zeigen.
      if (drafts.some((d) => d.day === slot.day && sameEvent(d, slot))) {
        counts.duplicates++
        continue
      }
      // Wahrscheinliches Duplikat einer veroeffentlichten Party: Entwurf mit Hinweis.
      const duplicateOf = parties.find((p) => p.day === slot.day && sameEvent(p, slot))?.id ?? null

      const type: EventType = (EVENT_TYPES as readonly string[]).includes(c.ev.type) ? (c.ev.type as EventType) : category.id
      const pool = photos.get(type)?.length ? photos.get(type)! : photos.get(category.id)!
      const photo = pool[Math.floor(Math.random() * pool.length)]
      const location = cut([c.ev.venue, c.ev.address].filter(Boolean).join(', ') || c.label, 500)

      const inserted = await sql`
        insert into private.agent_candidates (
          kind, run_id, title, starts_at, ends_at, starts_on, location, lat, lng, event_type, price,
          organizer_name, website_url, source_url, description, background_url, duplicate_of
        ) values (
          'new', ${run.id}, ${title}, ${startsAt}, ${endsAt}, ${c.ev.date}::date, ${location}, ${c.lat}, ${c.lng},
          ${type}, ${c.price}, ${c.ev.organizer ? cut(c.ev.organizer, 200) : null}, ${validWebsite(c.ev.website_url)},
          ${c.ev.source_url}, ${description(c.ev, c.free)},
          ${`${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/event-backgrounds/${photo}`}, ${duplicateOf}
        )
        on conflict (source_url, starts_on) where kind = 'new' and status in ('draft', 'approved') do nothing
        returning id`
      if (inserted.length) {
        counts.drafts++
        drafts.push(slot)
      } else counts.duplicates++
    }
  } catch (err) {
    error = (err instanceof Error ? err.message : String(err)).slice(0, 2000)
  }

  const cost = Math.round(usage.costUsd * 10000) / 10000
  await sql`
    update private.agent_runs set
      finished_at = now(), found = ${counts.found}, verified = ${counts.verified},
      discarded = ${counts.discarded}, duplicates = ${counts.duplicates}, drafts = ${counts.drafts},
      input_tokens = ${usage.inputTokens}, output_tokens = ${usage.outputTokens},
      web_searches = ${usage.searches}, cost_usd = ${cost}, error = ${error}
    where id = ${run.id}`
  await sql.end()

  // Nur Zahlen und Gruende, keine Inhalte.
  console.log(JSON.stringify({ run: run.id, category: category.id, ...counts, cost_usd: cost, error }))
  return json(error && !counts.drafts ? 500 : 200, {
    run_id: run.id,
    category: category.id,
    ...counts,
    discard_reasons: reasons,
    web_searches: usage.searches,
    web_fetches: usage.fetches,
    cost_usd: cost,
    seconds: Math.round((Date.now() - started) / 1000),
    error,
  })
})
