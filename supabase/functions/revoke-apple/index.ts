// Apple-Autorisierung beim Loeschen des Accounts widerrufen (Schritt 13c, App Store
// Richtlinie 5.1.1(v)).
//
// Kein gespeichertes Apple-Token, keine Tabelle: die App laesst den Nutzer vor dem
// Loeschen einmal mit Apple bestaetigen und schickt den frischen authorizationCode
// hierher. Die Funktion tauscht ihn bei Apple gegen ein refresh_token und widerruft das
// sofort. Danach loescht die App wie bisher (delete_self).
//
// verify_jwt ist an: nur ein angemeldeter Nutzer kommt hier an. Der Code muss zu SEINER
// Apple-Identitaet gehoeren (sub im id_token gleich identity_data.sub), sonst wird nichts
// widerrufen. Sonst koennte jemand fremde Autorisierungen widerrufen oder abfragen.
//
// Apple-Schluessel nur aus den Secrets APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY
// (.p8-Inhalt), APPLE_CLIENT_ID. client_secret wird bei jedem Aufruf neu signiert und
// gilt fuenf Minuten, also muss nichts erneuert werden. Geloggt werden nur Schritt,
// HTTP-Status und Apples Fehlercode: nie Code, Token, Schluessel oder Nutzer-IDs.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const APPLE = 'https://appleid.apple.com'
const encoder = new TextEncoder()

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeJwtPayload(jwt: string): { sub?: string } {
  const part = jwt.split('.')[1] ?? ''
  const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')
  return JSON.parse(atob(padded))
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

// ES256: WebCrypto liefert die Signatur schon roh als r||s (64 Bytes), so wie JWS sie will.
async function clientSecret(teamId: string, keyId: string, clientId: string, p8: string) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(encoder.encode(JSON.stringify({ alg: 'ES256', kid: keyId })))
  const payload = base64url(
    encoder.encode(JSON.stringify({ iss: teamId, iat: now, exp: now + 300, aud: APPLE, sub: clientId })),
  )
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    await importKey(p8),
    encoder.encode(`${header}.${payload}`),
  )
  return `${header}.${payload}.${base64url(new Uint8Array(signature))}`
}

// Nur Apples Fehlercode (z. B. invalid_grant), nie der ganze Body.
async function appleError(res: Response) {
  try {
    return ((await res.json()) as { error?: string }).error ?? ''
  } catch {
    return ''
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const secrets = {
    APPLE_TEAM_ID: Deno.env.get('APPLE_TEAM_ID'),
    APPLE_KEY_ID: Deno.env.get('APPLE_KEY_ID'),
    APPLE_PRIVATE_KEY: Deno.env.get('APPLE_PRIVATE_KEY'),
    APPLE_CLIENT_ID: Deno.env.get('APPLE_CLIENT_ID'),
  }
  const missing = Object.entries(secrets).filter(([, value]) => !value).map(([name]) => name)
  if (missing.length) {
    console.error('Missing secrets', missing.join(', '))
    return json(500, { error: 'not_configured' })
  }
  const { APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY, APPLE_CLIENT_ID } = secrets as Record<string, string>

  let code = ''
  try {
    code = ((await req.json()) as { code?: unknown }).code as string
  } catch {
    // kein JSON: wie ein fehlender Code
  }
  if (typeof code !== 'string' || !code) return json(400, { error: 'missing_code' })

  try {
    // Der Aufrufer, mit seinem eigenen JWT. Nur anon-Key, kein Service-Role-Key.
    const userRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
      headers: {
        Authorization: req.headers.get('Authorization') ?? '',
        apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      },
    })
    if (!userRes.ok) {
      console.error('User lookup failed', userRes.status)
      return json(401, { error: 'unauthorized' })
    }
    const user = (await userRes.json()) as {
      identities?: { provider: string; identity_data?: { sub?: string } }[]
    }
    const appleSub = user.identities?.find((i) => i.provider === 'apple')?.identity_data?.sub
    if (!appleSub) return json(403, { error: 'not_apple' })

    const secret = await clientSecret(APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_CLIENT_ID, APPLE_PRIVATE_KEY)

    // Code aus der nativen App: ohne redirect_uri, weil die Anfrage keine hatte.
    const tokenRes = await fetch(`${APPLE}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: APPLE_CLIENT_ID,
        client_secret: secret,
        grant_type: 'authorization_code',
        code,
      }),
    })
    if (!tokenRes.ok) {
      console.error('Apple token exchange refused', tokenRes.status, await appleError(tokenRes))
      return json(502, { error: 'apple_failed' })
    }
    const tokens = (await tokenRes.json()) as { refresh_token?: string; id_token?: string }
    if (!tokens.refresh_token || !tokens.id_token) {
      console.error('Apple token exchange returned no refresh_token or id_token')
      return json(502, { error: 'apple_failed' })
    }

    // Die Signatur des id_token muss nicht geprueft werden: es kommt direkt von Apple
    // ueber TLS, im Tausch gegen ein Geheimnis, das nur wir haben.
    if (decodeJwtPayload(tokens.id_token).sub !== appleSub) {
      console.error('Apple ID mismatch, nothing revoked')
      return json(403, { error: 'apple_id_mismatch' })
    }

    const revokeRes = await fetch(`${APPLE}/auth/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: APPLE_CLIENT_ID,
        client_secret: secret,
        token: tokens.refresh_token,
        token_type_hint: 'refresh_token',
      }),
    })
    if (!revokeRes.ok) {
      console.error('Apple revoke refused', revokeRes.status, await appleError(revokeRes))
      return json(502, { error: 'apple_failed' })
    }
    return json(200, { revoked: true })
  } catch (error) {
    // Netzwerk, kaputter Schluessel, unlesbare Antwort. Nur der Fehlertyp, keine Inhalte.
    console.error('Revoke failed', (error as Error).name)
    return json(502, { error: 'apple_failed' })
  }
})
