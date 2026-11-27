// Adresse -> Koordinaten ueber Photon, derselbe Dienst wie die Adresssuche der App
// (features/parties/services/address.service.ts). Kein Schluessel, Server in Deutschland.
// Gesendet wird nur die oeffentliche Adresse des Events, nichts ueber Personen.
//
// Zwei Wege zu Photon:
// 1. Direkt aus der Edge Function.
// 2. Ueber die Datenbank (private.photon_get, Erweiterung http). Seit dem Lauf vom
//    2026-11-23 antwortet Photon den Edge Functions mit HTTP 403, der Datenbank aber normal
//    (getestet 2026-11-27). Die Edge Functions teilen sich ihre Adressen mit vielen anderen
//    Projekten, die Datenbank nicht. pg_net geht nicht: der Agent wird selbst ueber pg_net
//    gestartet, und dessen Worker holt neue Anfragen erst nach dem Ende dieses Aufrufs ab.
// Scheitert Weg 1 einmal, nimmt der Aufruf fuer den Rest Weg 2. Scheitern beide, wird das
// Event verworfen und der Grund steht in geoProblem.
//
// Nominatim ist kein Ersatz: es antwortet den Supabase-Servern mit HTTP 403 (getestet
// 2026-11-12).

import type postgres from 'npm:postgres@3.4.5'

const PHOTON = 'https://photon.komoot.io/api/'
const USER_AGENT = 'areuout-party-agent (+https://www.areuout.de)'
const TIMEOUT_MS = 10_000
// Grob Stadt und Landkreis Leipzig. Ein Treffer ausserhalb ist fast sicher ein falscher
// Ort gleichen Namens und wird verworfen.
const AREA = { minLat: 51.0, maxLat: 51.6, minLng: 12.0, maxLng: 13.1 }
const BBOX = `${AREA.minLng},${AREA.minLat},${AREA.maxLng},${AREA.maxLat}`

type PhotonFeature = {
  geometry: { coordinates: [number, number] }
  properties: { countrycode?: string; name?: string; street?: string; housenumber?: string; postcode?: string; city?: string }
}

export type Place = { lat: number; lng: number; label: string }

// Letzter technischer Grund, warum Photon auf keinem der beiden Wege antwortete. Danach
// wird Photon fuer den Rest des Aufrufs nicht mehr gefragt, damit nicht jedes Event auf
// einen Timeout wartet.
export let geoProblem: string | null = null
// Grund, warum der direkte Weg aufgegeben wurde (nur fuer das Protokoll).
export let directProblem: string | null = null
let viaDb = false
let db: postgres.Sql | null = null

// A warm worker keeps this module between calls, so each call starts on the direct way
// again. Otherwise one outage would also hit every later category on the same worker.
export function resetGeoProblem(sql: postgres.Sql) {
  geoProblem = null
  directProblem = null
  viaDb = false
  db = sql
}

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err))

async function fetchDirect(url: string): Promise<string> {
  const r = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.text()
}

async function fetchViaDb(url: string): Promise<string> {
  if (!db) throw new Error('keine Datenbankverbindung')
  const [r] = await db<{ status: number; content: string | null }[]>`select status, content from private.photon_get(${url})`
  if (!r) throw new Error('keine Antwort')
  if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
  return r.content ?? ''
}

async function fetchPhoton(url: string): Promise<string> {
  if (!viaDb) {
    try {
      return await fetchDirect(url)
    } catch (err) {
      directProblem ??= errText(err)
      viaDb = true
    }
  }
  try {
    return await fetchViaDb(url)
  } catch (err) {
    throw new Error(`direkt ${directProblem}, ueber DB ${errText(err)}`)
  }
}

async function search(query: string): Promise<Place | null> {
  if (geoProblem) return null
  try {
    const body = await fetchPhoton(`${PHOTON}?q=${encodeURIComponent(query)}&limit=5&lang=de&bbox=${BBOX}`)
    const { features }: { features: PhotonFeature[] } = JSON.parse(body)
    for (const f of features) {
      const [lng, lat] = f.geometry.coordinates
      const p = f.properties
      if (p.countrycode && p.countrycode !== 'DE') continue
      if (lat < AREA.minLat || lat > AREA.maxLat || lng < AREA.minLng || lng > AREA.maxLng) continue
      const street = [p.street, p.housenumber].filter(Boolean).join(' ')
      const label = [...new Set([p.name, street, [p.postcode, p.city].filter(Boolean).join(' ')].filter(Boolean))].join(', ')
      return { lat, lng, label }
    }
    return null
  } catch (err) {
    geoProblem = `Photon: ${errText(err)}`.slice(0, 200)
    return null
  }
}

// Erst die Adresse, dann der Ort mit Stadt. null = nicht gefunden, das Event wird verworfen.
export async function geocode(venue: string | null, address: string | null, city: string): Promise<Place | null> {
  if (address) {
    const hit = await search(address.toLowerCase().includes(city.toLowerCase()) ? address : `${address}, ${city}`)
    if (hit) return hit
  }
  if (venue) return search(`${venue}, ${city}`)
  return null
}
