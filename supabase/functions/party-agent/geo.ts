// Adresse -> Koordinaten ueber Photon, derselbe Dienst wie die Adresssuche der App
// (features/parties/services/address.service.ts). Kein Schluessel, Server in Deutschland.
// Gesendet wird nur die oeffentliche Adresse des Events, nichts ueber Personen.
//
// Kein Ersatzdienst: Nominatim antwortet den Supabase-Servern mit HTTP 403 (getestet
// 2026-11-12). Ist Photon nicht erreichbar, scheitert das Geocoding und der Grund steht in
// den Verwerfungs-Gruenden der Antwort.

const PHOTON = 'https://photon.komoot.io/api/'
// Grob Stadt und Landkreis Leipzig. Ein Treffer ausserhalb ist fast sicher ein falscher
// Ort gleichen Namens und wird verworfen.
const AREA = { minLat: 51.0, maxLat: 51.6, minLng: 12.0, maxLng: 13.1 }
const BBOX = `${AREA.minLng},${AREA.minLat},${AREA.maxLng},${AREA.maxLat}`

type PhotonFeature = {
  geometry: { coordinates: [number, number] }
  properties: { countrycode?: string; name?: string; street?: string; housenumber?: string; postcode?: string; city?: string }
}

export type Place = { lat: number; lng: number; label: string }

// Letzter technischer Grund, warum Photon nicht antwortete. Nach dem ersten Ausfall wird
// Photon fuer den Rest des Laufs nicht mehr gefragt, damit nicht jedes Event auf einen
// Timeout wartet.
export let geoProblem: string | null = null

async function search(query: string): Promise<Place | null> {
  if (geoProblem) return null
  try {
    const r = await fetch(`${PHOTON}?q=${encodeURIComponent(query)}&limit=5&lang=de&bbox=${BBOX}`, {
      headers: { 'user-agent': 'areuout-party-agent' },
      signal: AbortSignal.timeout(10000),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const { features }: { features: PhotonFeature[] } = await r.json()
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
    geoProblem = `Photon: ${err instanceof Error ? err.message : String(err)}`
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
