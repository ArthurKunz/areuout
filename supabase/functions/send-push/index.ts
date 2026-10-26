// Push-Versand (Push, Commit 4 der Stores): schickt eine sichtbare Mitteilung an eine
// Liste von APNs-Geraete-Tokens. Liest keine Tabelle, kennt keine Personen: wer welche
// Tokens bekommt, entscheidet der Aufrufer (die Trigger aus Commit 5).
//
// verify_jwt ist aus: der Aufrufer ist spaeter die Datenbank ueber pg_net, ohne JWT.
// Stattdessen muss der Header x-push-secret PUSH_SECRET gleichen. Alles andere bekommt
// 403, bevor Apple beruehrt wird.
//
// Apple-Schluessel nur aus den Secrets APNS_PRIVATE_KEY (.p8-Inhalt), APNS_KEY_ID,
// APNS_TEAM_ID. Erst der Produktions-Host; antwortet Apple dort BadDeviceToken, stammt
// das Token vermutlich aus einem Debug-Build, also noch einmal an den Sandbox-Host.
//
// Lock-Screen-Text: nur der Partytitel, nie der Name einer Person (CLAUDE.md). Geloggt
// werden nur Schritt, HTTP-Status und Apples reason: nie Token, Titel, Text, JWT oder
// Schluessel. Tote Tokens werden gemeldet, aber nicht geloescht.

import { timingSafeEqual } from 'jsr:@std/crypto@1/timing-safe-equal'

const HOSTS = { production: 'https://api.push.apple.com', sandbox: 'https://api.sandbox.push.apple.com' }
const TOPIC = 'de.areuout.app'
const TOKEN = /^[0-9a-f]{64,200}$/
const MAX_TOKENS = 50
const MAX_TITLE = 100
const MAX_BODY = 200
const MAX_PAYLOAD = 4096
// Apple will ein neues JWT spaetestens alle 60 Minuten und nicht oefter als alle 20.
const JWT_MAX_AGE = 50 * 60

const encoder = new TextEncoder()

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// timingSafeEqual wirft bei ungleicher Laenge. Beide Seiten erst hashen: immer 32 Bytes,
// und die Laenge des Geheimnisses verraet sich auch nicht.
async function hasSecret(req: Request): Promise<boolean> {
  const expected = Deno.env.get('PUSH_SECRET')
  const given = req.headers.get('x-push-secret')
  if (!expected || !given) return false
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(given)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  return timingSafeEqual(a, b)
}

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Der .p8-Inhalt kommt mit echten Zeilenumbruechen oder mit \n als Text an, je nachdem
// wie er gesetzt wurde. Beides wird zu den reinen Base64-Bytes des PKCS#8-Schluessels.
async function importKey(p8: string) {
  const base64 = p8
    .replace(/\\n/g, '\n')
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')
  const der = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
}

// Pro Isolate zwischengespeichert. Ein neues Isolate oeffnet auch eine neue Verbindung,
// die 20-Minuten-Regel gilt bei Apple pro Verbindung.
let cached: { jwt: string; iat: number } | null = null

// ES256: WebCrypto liefert die Signatur schon roh als r||s (64 Bytes), so wie JWS sie will.
async function providerToken(teamId: string, keyId: string, p8: string) {
  const now = Math.floor(Date.now() / 1000)
  if (cached && now - cached.iat < JWT_MAX_AGE) return cached.jwt
  const header = base64url(encoder.encode(JSON.stringify({ alg: 'ES256', kid: keyId })))
  const payload = base64url(encoder.encode(JSON.stringify({ iss: teamId, iat: now })))
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    await importKey(p8),
    encoder.encode(`${header}.${payload}`),
  )
  cached = { jwt: `${header}.${payload}.${base64url(new Uint8Array(signature))}`, iat: now }
  return cached.jwt
}

type Input = { tokens: string[]; title: string; body: string; data?: Record<string, unknown> }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Alles oder nichts: ein falscher Wert verwirft die ganze Anfrage.
function parse(input: unknown): Input | null {
  if (!isObject(input)) return null
  const { tokens, title, body, data, ...rest } = input
  if (Object.keys(rest).length) return null
  if (!Array.isArray(tokens) || tokens.length < 1 || tokens.length > MAX_TOKENS) return null
  if (!tokens.every((t) => typeof t === 'string' && TOKEN.test(t))) return null
  if (typeof title !== 'string' || title.length < 1 || title.length > MAX_TITLE) return null
  if (typeof body !== 'string' || body.length < 1 || body.length > MAX_BODY) return null
  if (data !== undefined && (!isObject(data) || 'aps' in data)) return null
  return { tokens: [...new Set(tokens as string[])], title, body, data }
}

type Outcome = 'sent' | 'dead' | 'failed'

// Nur Apples reason (z. B. BadDeviceToken), nie der ganze Body.
async function reason(res: Response) {
  try {
    return ((await res.json()) as { reason?: string }).reason ?? ''
  } catch {
    return ''
  }
}

async function post(host: keyof typeof HOSTS, token: string, jwt: string, payload: string) {
  try {
    const res = await fetch(`${HOSTS[host]}/3/device/${token}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${jwt}`,
        'apns-topic': TOPIC,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'content-type': 'application/json',
      },
      body: payload,
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) {
      await res.body?.cancel()
      return { status: 200, reason: '' }
    }
    const why = await reason(res)
    console.error(host, res.status, why)
    return { status: res.status, reason: why }
  } catch (error) {
    // Netzwerk, Timeout, kein HTTP/2. Nur der Fehlertyp, keine Inhalte.
    console.error(host, 'fetch failed', (error as Error).name)
    return { status: 0, reason: '' }
  }
}

async function send(token: string, jwt: string, payload: string): Promise<Outcome> {
  const prod = await post('production', token, jwt, payload)
  if (prod.status === 200) return 'sent'
  if (prod.status === 410) return 'dead'
  if (prod.status !== 400 || prod.reason !== 'BadDeviceToken') return 'failed'

  const sandbox = await post('sandbox', token, jwt, payload)
  if (sandbox.status === 200) return 'sent'
  if (sandbox.status === 410 || (sandbox.status === 400 && sandbox.reason === 'BadDeviceToken')) return 'dead'
  return 'failed'
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' || !(await hasSecret(req))) {
    return new Response('Forbidden', { status: 403 })
  }

  const secrets = {
    APNS_PRIVATE_KEY: Deno.env.get('APNS_PRIVATE_KEY'),
    APNS_KEY_ID: Deno.env.get('APNS_KEY_ID'),
    APNS_TEAM_ID: Deno.env.get('APNS_TEAM_ID'),
  }
  const missing = Object.entries(secrets).filter(([, value]) => !value).map(([name]) => name)
  if (missing.length) {
    console.error('Missing secrets', missing.join(', '))
    return json(500, { error: 'not_configured' })
  }
  const { APNS_PRIVATE_KEY, APNS_KEY_ID, APNS_TEAM_ID } = secrets as Record<string, string>

  let input: Input | null = null
  try {
    input = parse(await req.json())
  } catch {
    // kein JSON: wie eine falsche Eingabe
  }
  if (!input) return json(400, { error: 'bad_request' })

  // Eigene Schluessel stehen neben aps, nie darin (Apple ignoriert sie dort).
  const payload = JSON.stringify({
    ...input.data,
    aps: { alert: { title: input.title, body: input.body }, sound: 'default' },
  })
  if (encoder.encode(payload).length > MAX_PAYLOAD) return json(400, { error: 'bad_request' })

  let jwt = ''
  try {
    jwt = await providerToken(APNS_TEAM_ID, APNS_KEY_ID, APNS_PRIVATE_KEY)
  } catch (error) {
    console.error('Signing failed', (error as Error).name)
    return json(500, { error: 'not_configured' })
  }

  const tokens = input.tokens
  const outcomes = await Promise.all(tokens.map((token) => send(token, jwt, payload)))
  return json(200, {
    sent: outcomes.filter((o) => o === 'sent').length,
    dead: tokens.filter((_, i) => outcomes[i] === 'dead'),
    failed: outcomes.filter((o) => o === 'failed').length,
  })
})
