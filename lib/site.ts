// Die eine Stelle, an der die App weiß, unter welcher Adresse sie läuft.
//
// Gebraucht wird das überall dort, wo eine RELATIVE Adresse nicht genügt: Open-Graph-
// Vorschauen, robots.txt und sitemap.xml müssen absolute URLs nennen. Im Browser
// reicht window.location.origin (siehe getOrigin in lib/utils), auf dem Server gibt
// es kein window — deshalb dieser Weg.
//
// Drei Quellen, in dieser Reihenfolge:
//
//   1. NEXT_PUBLIC_SITE_URL — die eigene Domain, sobald sie existiert. Das ist der
//      Wert, der am Ende gesetzt sein soll; er überschreibt alles andere.
//   2. VERCEL_PROJECT_PRODUCTION_URL — setzt Vercel selbst auf die Produktionsdomain
//      des Projekts. Damit stimmen die Vorschauen schon, bevor eine eigene Domain
//      eingetragen ist, und für jede Preview-Bereitstellung sowieso.
//   3. localhost — für die Entwicklung.
//
// Bewusst keine Ausnahme, wenn nichts gesetzt ist: eine falsche absolute URL fällt
// beim Teilen sofort auf, ein abgebrochener Build wäre die schlechtere Antwort.
const FALLBACK = 'http://localhost:3000'

// Genau dieselbe Begründung erzwingt das hier. Der Wert wird von Hand in ein
// Vercel-Formular getippt, und getippt wird eine Domain ohne Schema: 'areuout.de'
// statt 'https://areuout.de'. Der Rückgabewert landet in app/layout.tsx auf
// Modulebene in `new URL(siteUrl())`, und `new URL('areuout.de')` wirft — der Build
// bricht beim Prerendern ab und JEDE Route antwortet mit 500. Der Fehler wartet dabei
// auf den Launch-Tag: solange die Variable leer ist, greift der Vercel-Fallback und
// alles läuft. Deshalb wird ergänzt statt vertraut.
//
// Leerer String heisst 'unbrauchbar' und lässt den Aufrufer zur nächsten Quelle
// weitergehen. Eine Vercel-Domain ist immer noch die bessere Antwort als ein toter
// Build — siehe der Absatz oben.
function normalise(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  // Das Schema wird VOR dem Abschneiden der Schrägstriche geprüft, nicht danach: ein
  // blosses 'https://' verliert sonst beim Abschneiden sein eigenes '//', fällt damit
  // durch den Test und käme als 'https://https:' wieder heraus.
  //
  // http:// bleibt stehen, das ist localhost in der Entwicklung. '//areuout.de' ist
  // protokollrelativ und für new URL genauso unbrauchbar wie gar kein Schema, die
  // führenden Schrägstriche müssen deshalb weg, bevor https:// davorkommt.
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed.replace(/^\/+/, '')}`

  const withoutTrailingSlash = withScheme.replace(/\/+$/, '')
  return URL.canParse(withoutTrailingSlash) ? withoutTrailingSlash : ''
}

export function siteUrl(): string {
  const explicit = normalise(process.env.NEXT_PUBLIC_SITE_URL ?? '')
  if (explicit) return explicit

  // Vercel liefert den Wert ohne Schema.
  const vercel = normalise(process.env.VERCEL_PROJECT_PRODUCTION_URL ?? '')
  if (vercel) return vercel

  return FALLBACK
}
