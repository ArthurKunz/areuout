// Pruefung jedes Events gegen seine Quellseite, im Code und nicht durch das Modell
// (Vault: Party Agent, Abschnitt 8 "Verification"). Uebernommen aus verify.mjs des Spikes:
// robots.txt, Name, Datum und Ort auf der Seite, 14-Tage-Fenster, Preis auf der Seite.
// Neu: Seitengroesse begrenzt, numerische HTML-Entities, Beschreibung nicht abgeschrieben.

import type { FoundEvent, Window } from './prompt.ts'

const UA = 'areuout-party-agent'
const MAX_PAGE_CHARS = 2_000_000

const MONTHS = ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember']
const MONTHS_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

type Rule = { allow: boolean; pattern: string }
export type RobotsCache = Map<string, Rule[]>

async function robotsAllows(url: URL, cache: RobotsCache): Promise<boolean> {
  if (!cache.has(url.origin)) {
    const rules: Rule[] = []
    try {
      const r = await fetch(`${url.origin}/robots.txt`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(8000) })
      if (r.ok) {
        let applies = false
        for (const line of (await r.text()).split('\n')) {
          const [k, ...v] = line.split(':')
          const key = k.trim().toLowerCase()
          const val = v.join(':').split('#')[0].trim()
          if (key === 'user-agent') applies = val === '*' || val.toLowerCase().includes('areuout')
          else if (applies && (key === 'disallow' || key === 'allow') && val) rules.push({ allow: key === 'allow', pattern: val })
        }
      }
    } catch {
      // Kein robots.txt erreichbar: erlaubt.
    }
    cache.set(url.origin, rules)
  }
  // Uebliche Auswertung: `*` als Platzhalter, `$` als Ende, die laengste Regel gewinnt,
  // bei Gleichstand Allow.
  const path = url.pathname + url.search
  const toRegex = (p: string) =>
    new RegExp('^' + p.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$|\$$/, '$'))
  let best: Rule | null = null
  for (const rule of cache.get(url.origin) ?? []) {
    if (!toRegex(rule.pattern).test(path)) continue
    if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow)) best = rule
  }
  return !best || best.allow
}

export function pageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö').replace(/&uuml;/g, 'ü').replace(/&szlig;/g, 'ß')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function dateVariants(iso: string): string[] {
  const [y, m, d] = iso.split('-').map(Number)
  const dd = String(d).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  const de = MONTHS[m - 1]
  return [
    iso, `${dd}.${mm}.${y}`, `${d}.${m}.${y}`, `${dd}.${mm}.${String(y).slice(2)}`, `${dd}.${mm}.`, `${d}.${m}.`,
    `${d}. ${de}`, `${dd}. ${de}`, `${d} ${de}`,
    `${MONTHS_EN[m - 1]} ${d}`, `${d} ${MONTHS_EN[m - 1]}`,
    `${d}. ${de.slice(0, 3)}`, `${dd}. ${de.slice(0, 3)}`, `${d} ${de.slice(0, 3)}`, `${dd} ${de.slice(0, 3)}`,
    `${dd}/${mm}`, `${dd}-${mm}-${y}`,
  ]
}

export function wordsMatch(value: string | null, text: string, minShare: number): boolean {
  if (!value) return false
  const words = value.toLowerCase().split(/[^a-z0-9äöüß]+/).filter((w) => w.length >= 4)
  if (!words.length) return text.includes(value.toLowerCase())
  return words.filter((w) => text.includes(w)).length / words.length >= minShare
}

// null = kein Preis angegeben, true = auf der Seite gefunden, false = nicht gefunden.
export function priceOnPage(price: number | null, text: string): boolean | null {
  if (price == null) return null
  if (price === 0) return /eintritt frei|freier eintritt|kostenlos|kostenfrei|free entry|admission free|eintritt: frei/.test(text)
  const forms = new Set([String(price), price.toFixed(2).replace('.', ','), price.toFixed(2)])
  if (Number.isInteger(price)) forms.add(`${price},-`)
  return [...forms].some((f) => {
    const p = f.replace(/[.,]/g, '[.,]')
    return new RegExp(`(€\\s?${p}(?!\\d))|((?<![\\d,.])${p}\\s?(€|eur|euro))`).test(text)
  })
}

// Abgeschrieben, wenn 10 aufeinanderfolgende Woerter der Beschreibung so auf der Seite stehen.
export function copiedFromPage(description: string, text: string): boolean {
  const words = description.toLowerCase().split(/\s+/).filter(Boolean)
  for (let i = 0; i + 10 <= words.length; i++) {
    if (text.includes(words.slice(i, i + 10).join(' '))) return true
  }
  return false
}

export type Check = { ok: boolean; reasons: string[]; priceConfirmed: boolean | null }

export async function checkEvent(ev: FoundEvent, window: Window, robots: RobotsCache): Promise<Check> {
  const fail = (reason: string): Check => ({ ok: false, reasons: [reason], priceConfirmed: null })
  let url: URL
  try {
    url = new URL(ev.source_url)
  } catch {
    return fail('source_url ungueltig')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return fail('source_url ungueltig')
  if (ev.date < window.start || ev.date > window.end) return fail('Datum ausserhalb des Fensters')
  try {
    if (!(await robotsAllows(url, robots))) return fail('robots.txt verbietet')
    const r = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(15000) })
    if (!r.ok) return fail(`HTTP ${r.status}`)
    const text = pageText((await r.text()).slice(0, MAX_PAGE_CHARS))
    const reasons: string[] = []
    if (text.length < 300) reasons.push('Seite fast leer (vermutlich JavaScript)')
    if (!wordsMatch(ev.name, text, 0.5)) reasons.push('Name nicht auf der Seite')
    if (!dateVariants(ev.date).some((v) => text.includes(v))) reasons.push('Datum nicht auf der Seite')
    if (!wordsMatch(ev.venue, text, 0.5) && !wordsMatch(ev.address, text, 0.5)) reasons.push('Ort nicht auf der Seite')
    if (copiedFromPage(ev.description_de, text)) reasons.push('Beschreibung abgeschrieben')
    // Der Preis entscheidet nicht, ob das Event echt ist. Ein unbestaetigter Preis wird
    // geleert (nie raten), das Event kann trotzdem bestehen.
    return { ok: reasons.length === 0, reasons, priceConfirmed: priceOnPage(ev.price_eur, text) }
  } catch (err) {
    return fail(`Abruf gescheitert: ${err instanceof Error ? err.message : String(err)}`)
  }
}
