// Bausteine fuer die Duplikat-Pruefung (Vault: Party Agent, Abschnitt 8 "Duplicates").
// Wahrscheinliches Duplikat: gleicher Tag, ueberlappende Zeit, weniger als 100 m Abstand,
// aehnlicher Name. Die Namensaehnlichkeit entscheidet der Code, nicht ein zweiter
// Modellaufruf: billiger und jedes Mal gleich.

export const NEAR_METERS = 100
// Ohne Endzeit zaehlt fuer den Vergleich ein Zeitraum von 4 Stunden ab Beginn. Das ist nur
// eine Annahme fuer das Vergleichen, gespeichert wird sie nirgends.
const ASSUMED_HOURS = 4

export type Slot = { title: string; startsAt: Date; endsAt: Date | null; lat: number; lng: number }

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h))
}

const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9äöüß]+/).filter((w) => w.length >= 4))

// Aehnlich, wenn mindestens die Haelfte der langen Woerter des kuerzeren Namens im anderen
// vorkommt. Namen ohne lange Woerter: einer steckt im anderen.
export function similarNames(a: string, b: string): boolean {
  const wa = words(a)
  const wb = words(b)
  if (!wa.size || !wb.size) {
    const na = a.toLowerCase().replace(/\s+/g, ' ').trim()
    const nb = b.toLowerCase().replace(/\s+/g, ' ').trim()
    return na.includes(nb) || nb.includes(na)
  }
  const [small, big] = wa.size <= wb.size ? [wa, wb] : [wb, wa]
  return [...small].filter((w) => big.has(w)).length / small.size >= 0.5
}

const end = (s: Slot) => (s.endsAt ?? new Date(s.startsAt.getTime() + ASSUMED_HOURS * 3600_000)).getTime()

export function timesOverlap(a: Slot, b: Slot): boolean {
  return a.startsAt.getTime() < end(b) && b.startsAt.getTime() < end(a)
}

// Der Tag wird vom Aufrufer verglichen (Leipziger Kalendertag).
export function sameEvent(a: Slot, b: Slot): boolean {
  return timesOverlap(a, b) && distanceMeters(a, b) < NEAR_METERS && similarNames(a.title, b.title)
}
