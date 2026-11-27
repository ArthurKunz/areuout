// Bausteine fuer die Duplikat-Pruefung (Vault: Party Agent, Abschnitt 8 "Duplicates").
// Wahrscheinliches Duplikat: gleicher Tag, ueberlappende Zeit und entweder weniger als 100 m
// Abstand mit aehnlichem Namen oder weniger als 500 m mit gleichem Namen. Die
// Namensaehnlichkeit entscheidet der Code, nicht ein zweiter
// Modellaufruf: billiger und jedes Mal gleich.

export const NEAR_METERS = 100
// Gleicher Name: bis 500 m. Eine Adresse und der blosse Clubname landen beim Geocoding oft
// auf verschiedenen Gebaeuden desselben Gelaendes (Fuchsbau im Sky Club, 2026-11-14:
// 212 m). Zwei verschiedene Events mit gleichem Namen zur selben Zeit so nah gibt es kaum.
export const SAME_NAME_METERS = 500
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

const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöüß]+/g, ' ').trim()

// Gleich, wenn die Namen ohne Gross-/Kleinschreibung und Satzzeichen uebereinstimmen oder
// einer ganz im anderen steckt (mindestens 4 Zeichen, damit "Party" nicht alles trifft).
export function sameNames(a: string, b: string): boolean {
  const na = normName(a)
  const nb = normName(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na]
  return short.length >= 4 && ` ${long} `.includes(` ${short} `)
}

const end = (s: Slot) => (s.endsAt ?? new Date(s.startsAt.getTime() + ASSUMED_HOURS * 3600_000)).getTime()

export function timesOverlap(a: Slot, b: Slot): boolean {
  return a.startsAt.getTime() < end(b) && b.startsAt.getTime() < end(a)
}

// Der Tag wird vom Aufrufer verglichen (Leipziger Kalendertag).
export function sameEvent(a: Slot, b: Slot): boolean {
  if (!timesOverlap(a, b)) return false
  const d = distanceMeters(a, b)
  if (d < NEAR_METERS && similarNames(a.title, b.title)) return true
  return d < SAME_NAME_METERS && sameNames(a.title, b.title)
}
