// Meldungs-Benachrichtigung (Schritt 13b): jede neue Zeile in public.reports schickt
// Arthur eine E-Mail ueber Resend, damit die Zusage "jede Meldung innerhalb von 24
// Stunden" haltbar ist.
//
// Aufgerufen nur vom Trigger reports_email_new (private.email_new_report) ueber pg_net.
// verify_jwt ist aus: die Datenbank hat kein JWT ausser dem oeffentlichen anon-Key.
// Stattdessen muss der Header x-report-secret REPORT_EMAIL_SECRET gleichen (dasselbe
// Geheimnis liegt im Vault als report_email_secret). Alles andere bekommt 403, bevor
// Resend beruehrt wird.
//
// Inhalt nur id, kind, reason, created_at: keine Namen, keine Nutzer-IDs, keine Party,
// kein Wortlaut, weil die Mail ueber Resend und Google Mail laeuft (Datenschutz,
// Abschnitt 7). Den Rest liest Arthur mit der Abfrage aus der Mail im SQL-Editor.
//
// Feuer und vergessen: scheitert Resend, antwortet die Funktion 502 und loggt den Grund.
// Die Meldung ist dann trotzdem gespeichert; sichtbar in net._http_response (6 Stunden)
// und in der Liste offener Meldungen (SCHEMA.md 9c).

import { timingSafeEqual } from 'jsr:@std/crypto@1/timing-safe-equal'

const KINDS: Record<string, string> = { party: 'Party', answer: 'Antwort', user: 'Person' }
const REASONS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Belästigung',
  inappropriate: 'Unangemessene Inhalte',
  other: 'Etwas anderes',
}

const encoder = new TextEncoder()

// timingSafeEqual wirft bei ungleicher Laenge. Beide Seiten erst hashen: immer 32 Bytes,
// und die Laenge des Geheimnisses verraet sich auch nicht.
async function hasSecret(req: Request): Promise<boolean> {
  const expected = Deno.env.get('REPORT_EMAIL_SECRET')
  const given = req.headers.get('x-report-secret')
  if (!expected || !given) return false
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(given)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  return timingSafeEqual(a, b)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' || !(await hasSecret(req))) {
    return new Response('Forbidden', { status: 403 })
  }

  const { id, kind, reason, created_at } = await req.json()
  const time = new Date(created_at).toLocaleString('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const text = [
    'Neue Meldung in areuout.',
    '',
    `Art:   ${KINDS[kind] ?? kind}`,
    `Grund: ${REASONS[reason] ?? reason}`,
    `Zeit:  ${time}`,
    '',
    `Meldung: ${id}`,
    '',
    'Ansehen (SQL-Editor):',
    `select r.*, rep.firstname || ' ' || rep.lastname as melder, tgt.firstname || ' ' || tgt.lastname as gemeldet, e.title as party from public.reports r join public.profiles rep on rep.id = r.reporter_id join public.profiles tgt on tgt.id = r.reported_user_id left join public.events e on e.id = r.event_id where r.id = '${id}';`,
    '',
    'Erledigt:',
    `update public.reports set status = 'handled' where id = '${id}';`,
  ].join('\n')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'areuout <onboarding@resend.dev>',
      to: ['azzuro.kunz@gmail.com'],
      subject: `Neue Meldung: ${KINDS[kind] ?? kind}, ${REASONS[reason] ?? reason}`,
      text,
    }),
  })

  if (!res.ok) {
    console.error('Resend refused', res.status, await res.text())
    return new Response('Email failed', { status: 502 })
  }
  return new Response('OK')
})
