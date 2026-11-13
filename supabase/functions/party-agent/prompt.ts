// Aufgabe, Kategorien und Antwortformat, uebernommen aus dem Spike (spikes/party-agent:
// prompt.mjs, queries.json; Vault: Party Agent Spike, Lauf 5). Dazu die Zeitrechnung in
// Europe/Berlin, weil Tage und Uhrzeiten der Quellseiten Leipziger Ortszeit sind.

export type Category = { id: 'club' | 'concert' | 'festival' | 'open_air'; label: string; queries: string[] }

export const CATEGORIES: Category[] = [
  {
    id: 'club',
    label: 'Club events and parties',
    queries: ['Party Leipzig dieses Wochenende', 'Club Leipzig Events', 'Techno Leipzig Party', 'Studentenparty Leipzig'],
  },
  {
    id: 'concert',
    label: 'Concerts with a party character (pop, rock, hip-hop, electronic, indie; no classical)',
    queries: ['Konzerte Leipzig Pop Rock', 'Hip Hop Konzert Leipzig', 'Live Musik Club Leipzig'],
  },
  {
    id: 'festival',
    label: 'City and village festivals with music (no markets)',
    queries: ['Stadtfest Landkreis Leipzig Musik', 'Dorffest Landkreis Leipzig', 'Festival Leipzig Musik'],
  },
  {
    id: 'open_air',
    label: 'Open airs and outdoor events',
    queries: ['Open Air Leipzig', 'Outdoor Party Leipzig'],
  },
]

export const EVENT_TYPES = ['club', 'concert', 'festival', 'open_air', 'other'] as const
export type EventType = (typeof EVENT_TYPES)[number]

export type FoundEvent = {
  name: string
  date: string
  start_time: string | null
  end_time: string | null
  venue: string | null
  address: string | null
  city: string
  type: string
  price_eur: number | null
  organizer: string | null
  website_url: string | null
  source_url: string
  description_de: string
}

export type Window = { start: string; end: string }

// Heute und heute + 14 Tage, als Kalendertage in Leipzig.
export function windowDates(now = new Date()): Window {
  const iso = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
  const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  return { start: iso(now), end: iso(end) }
}

export function buildPrompt(category: Category, { start, end }: Window): string {
  return `You are researching public events for areuout, an app that shows what is happening in Leipzig.

Task: find public ${category.label} in the city of Leipzig and the Landkreis Leipzig (Germany) that take place between ${start} and ${end} (inclusive).

Search the web. Useful starting queries (you may use others): ${category.queries.map((q) => `"${q}"`).join(', ')}.

Rules:
- Only real, public events you found on a web page. Never invent an event, a date, a time, a place or a price.
- Every event needs the URL of the page where you found it ("source_url"). Prefer the organiser's or venue's own page over aggregators.
- If a value is not stated on the source page, use null. Do not guess.
- name: the event's name as stated, at most 60 characters (use the shortest official form).
- price_eur: the box office price, or the lowest stated price if there are several. 0 only if the page says the event is free. null if not stated.
- description_de: 1-2 sentences in German, in your own words. Never copy text from the page.
- Do not pull one single event calendar in bulk. Collect across several sources.
- Only events about music and celebrating: club nights, parties, concerts with a party
  character (pop, rock, hip-hop, electronic, indie, schlager and similar), open airs, and
  city or village festivals with music. Skip classical concerts, opera and orchestras,
  markets (including Christmas markets), food festivals, sports, fitness, talks,
  workshops, theatre and exhibitions.
- Skip private events, closed events, and events outside Leipzig / Landkreis Leipzig.
- Aim for completeness within this category, but quality beats quantity.

Answer with ONLY a JSON code block, no other text, in exactly this shape:

\`\`\`json
{
  "events": [
    {
      "name": "string",
      "date": "YYYY-MM-DD",
      "start_time": "HH:MM or null",
      "end_time": "HH:MM or null",
      "venue": "string or null",
      "address": "string or null",
      "city": "string",
      "type": "club | concert | festival | open_air | other",
      "price_eur": "number or null",
      "organizer": "string or null",
      "website_url": "string or null",
      "source_url": "string",
      "description_de": "string"
    }
  ]
}
\`\`\``
}

// Das JSON-Objekt aus der Antwort ziehen. Verzeiht einen fehlenden Codeblock.
// null = unlesbar (zum Beispiel abgeschnitten).
export function parseEvents(text: string): unknown[] | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && 'events' in parsed && Array.isArray(parsed.events)) return parsed.events
    return []
  } catch {
    return null
  }
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

// Prueft die Form eines Eintrags. Was nicht passt, wird null und damit verworfen.
export function toFoundEvent(v: unknown): FoundEvent | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const name = str(o.name)
  const date = str(o.date)
  const source = str(o.source_url)
  const description = str(o.description_de)
  if (!name || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !source || !description) return null
  const time = (t: unknown) => {
    const s = str(t)
    return s && /^\d{1,2}:\d{2}$/.test(s) ? s.padStart(5, '0') : null
  }
  const price = typeof o.price_eur === 'number' && Number.isFinite(o.price_eur) && o.price_eur >= 0 ? o.price_eur : null
  return {
    name,
    date,
    start_time: time(o.start_time),
    end_time: time(o.end_time),
    venue: str(o.venue),
    address: str(o.address),
    city: str(o.city) ?? 'Leipzig',
    type: str(o.type) ?? '',
    price_eur: price,
    organizer: str(o.organizer),
    website_url: str(o.website_url),
    source_url: source,
    description_de: description,
  }
}

// Minuten, um die Berlin zum Zeitpunkt `at` vor UTC liegt (60 oder 120).
function berlinOffsetMinutes(at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Berlin',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  )
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute)
  return Math.round((asUtc - at.getTime()) / 60000)
}

// Leipziger Kalendertag + Uhrzeit -> Zeitpunkt.
export function berlinToDate(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  return new Date(guess - berlinOffsetMinutes(new Date(guess)) * 60000)
}
