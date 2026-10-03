// Photon, komoot's search over the same OpenStreetMap data: free, no key, and — the
// reason it is here rather than Nominatim — built for type-ahead. Nominatim matches
// whole addresses, so a lone 'B' or a half-typed street finds nothing, and its usage
// policy asks not to be used for autocomplete at all.
const PHOTON = 'https://photon.komoot.io/api/'
export const DEBOUNCE_MS = 400
// Kürzere Eingaben verlassen das Gerät gar nicht erst. Die Entprellung oben verhindert
// schon, dass jeder Tastendruck rausgeht — aber wer 'Ta' tippt und dann überlegt, hatte
// bisher trotzdem 'Ta' bei komoot liegen, ohne je eine brauchbare Antwort zu bekommen.
//
// Drei und nicht mehr: Photon wurde laut Kommentar oben genau deshalb Nominatim
// vorgezogen, weil es auch mit Bruchstücken umgehen kann. Bei vier Zeichen wären
// Eingaben wie 'Am 5' kaputt.
export const MIN_QUERY_LENGTH = 3
// Photon has no country filter, so the search is boxed to roughly DACH and the
// stragglers from across the borders are dropped below.
const DACH_BBOX = '5.8,45.7,17.2,55.1'
const COUNTRIES = ['DE', 'AT', 'CH']
const MAX_RESULTS = 6

export type AddressResult = { id: string; street: string; city: string; label: string; lat: number; lng: number }

type PhotonFeature = {
  // GeoJSON order: longitude first.
  geometry: { coordinates: [number, number] }
  properties: {
    osm_type?: string
    osm_id?: number
    countrycode?: string
    name?: string
    street?: string
    housenumber?: string
    postcode?: string
    city?: string
    state?: string
    country?: string
  }
}

function toResult(feature: PhotonFeature): AddressResult {
  const p = feature.properties
  const [lng, lat] = feature.geometry.coordinates
  const address = [p.street, p.housenumber].filter(Boolean).join(' ')
  // Two hits can share a label (the same street in two postcodes), so the OSM id is
  // what keeps the React keys apart.
  const label = [...new Set([p.name, address, p.postcode, p.city, p.country].filter(Boolean))].join(', ')
  return {
    id: p.osm_id ? `${p.osm_type ?? ''}${p.osm_id}` : label,
    // A named place (a club, a park, a whole city) carries no street of its own, so
    // its name becomes the address instead of dropping the hit.
    street: address || p.name || '',
    city: p.city ?? p.state ?? '',
    label,
    lat,
    lng,
  }
}

// Rejects when `signal` aborts; callers treat that as the normal case, not a failure.
export async function searchAddresses(term: string, signal: AbortSignal): Promise<AddressResult[]> {
  // Over-fetched because the country filter below runs here, not on the server.
  const url = `${PHOTON}?q=${encodeURIComponent(term)}&limit=15&lang=de&bbox=${DACH_BBOX}`
  const response = await fetch(url, { signal })
  const { features }: { features: PhotonFeature[] } = await response.json()
  return features
    .filter((f) => !f.properties.countrycode || COUNTRIES.includes(f.properties.countrycode))
    .map(toResult)
    .slice(0, MAX_RESULTS)
}
