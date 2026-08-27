import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Browser-native alerts only: readable German line + the raw technical detail underneath.
export function alertError(message: string, detail?: string) {
  alert(detail ? `${message}\n\n${detail}` : message)
}

// Empty string during SSR; callers only build absolute links on the client.
export function getOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin
}

// Where to land after auth/onboarding. Only same-site paths are accepted, so a
// crafted ?next=https://evil.example cannot turn the login flow into a redirector.
//
// Der Backslash ist der Grund, warum hier mehr steht als die beiden offensichtlichen
// Prüfungen: Der URL-Parser behandelt \ in einer speziellen Schema-URL wie /, also ist
// '/\evil.example' protokollrelativ. Es beginnt mit einem Slash und nicht mit zwei,
// kam also durch — und `new URL(ziel, origin)` in proxy.ts machte daraus
// https://evil.example/. Ein angemeldeter Nutzer, der /login?next=/\phishing.example
// öffnet, wurde von der eigenen Domain aus weggeleitet.
//
// Steuerzeichen fliegen aus demselben Grund raus: Tab, CR und LF werden beim Parsen
// stillschweigend entfernt, '/\tevil' und '/e\nvil' sähen hier also anders aus als das,
// wohin der Browser am Ende geht.
export function sanitizeNextPath(next: string | null | undefined): string | null {
  if (!next) return null
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return null
  if (!next.startsWith('/') || next.startsWith('//')) return null
  return next
}

// Crockford's base32 without I, L, O and U — the four that get misread when somebody
// reads a link aloud or types it off another screen. Exactly 32 symbols, which matters
// below: 256 divides by 32, so `byte % 32` is unbiased and needs no rejection loop.
const CODE_ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'
const CODE_LENGTH = 12

// The invite code is the only thing between a link and somebody's home address plus a
// guest list of real names. Two things were wrong with the previous version.
//
// It fell back to Math.random when crypto.randomUUID was missing, and that fallback was
// not hypothetical: randomUUID is a secure-context feature, so on http://192.168.x.x —
// the LAN address in next.config.ts, used for testing on a phone — it is undefined and
// every code came out of Math.random. That is a predictable generator; a handful of
// outputs is enough to reconstruct its state. getRandomValues has no such restriction
// (it is the one member of Crypto usable from an insecure context), so there is nothing
// left to fall back to. If it were ever absent this throws, which is the right outcome:
// a party without a code beats a party with a guessable one.
//
// And ten hex characters is 40 bits. Measured against the live API, the anon lookup has
// no rate limit at all — 150 of 150 requests answered at 55/s from one machine. An
// attacker wants ANY party, not a specific one, so the work drops as the app grows: at
// 100k parties and 2000 requests per second, expect a hit in about 90 minutes. Twelve
// base32 symbols is 60 bits, which turns those 90 minutes into roughly 180 years.
//
// Collisions stop being worth a thought at that size — invite_code is UNIQUE, and the
// birthday bound sits around a billion parties.
export function generateInviteCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)

  let code = ''
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length]
  return code
}

// How long a party is assumed to run when the host set no end time. Six hours means
// one that starts at 20:00 counts as over at 02:00 — not at 20:01, while the guests
// are still looking up the address.
const ASSUMED_PARTY_HOURS = 6

export function isPartyOver(eventDate: string, endsAt?: string | null): boolean {
  const end = endsAt
    ? new Date(endsAt)
    : new Date(new Date(eventDate).getTime() + ASSUMED_PARTY_HOURS * 60 * 60 * 1000)
  return end.getTime() < Date.now()
}

export function getInitials(firstname: string | null, lastname: string | null): string {
  const first = firstname?.trim()?.[0] ?? ''
  const last = lastname?.trim()?.[0] ?? ''
  return (first + last).toUpperCase() || '?'
}

const COVER_GRADIENTS = [
  'from-brand-pink to-brand-lila',
  'from-brand-lila to-brand-blue',
  'from-brand-blue to-brand-pink',
]

// Deterministic per-party cover gradient (no party images in V1, so we fake a "cover photo").
export function partyCoverGradient(id: string): string {
  const hash = id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return COVER_GRADIENTS[hash % COVER_GRADIENTS.length]
}