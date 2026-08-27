import type { Metadata } from 'next'
import InviteScreen from '@/features/parties/InviteScreen'
import { createClient } from '@/lib/supabase/server'
import { isPartyOver } from '@/lib/utils'

type Params = { invite_code: string }

// Der Einladungslink ist das Herzstück der App — er beantwortet die Frage, mit der
// alles anfing: "Events sind unsichtbar, wenn du nicht in der richtigen Gruppe bist."
// Ohne das hier sah genau dieser Link in WhatsApp aus wie jeder andere: Titel und
// Beschreibung kamen aus dem Root-Layout, also "areuout — Entdecke und
// erstelle Partys für Studierende". Nicht der Partyname, nicht das Datum, kein Bild.
//
// Warum das serverseitig passieren MUSS: InviteScreen ist eine Client-Komponente, die
// ihre Daten erst nach dem Laden holt. Ein Vorschau-Crawler führt kein JavaScript aus
// und sieht deshalb nur ein leeres Gerüst. Die Vorschau kann nur hier entstehen.
//
// Die Party wird über get_party_by_invite_code gelesen — dieselbe RPC wie im Client,
// für anon freigegeben, auf den Code geschlüsselt.
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { invite_code } = await params

  // Diese Funktion darf unter keinen Umständen die Seite mitreißen. Wirft sie, liefert
  // Next einen Fehler statt der Einladung aus — und das ist die eine Route, bei der
  // das richtig weh tut. Deshalb faengt sie alles ab und faellt auf den Titel aus dem
  // Root-Layout zurueck, was genau der Zustand von vorher ist.
  try {
    const supabase = await createClient()
    const { data } = await supabase.rpc('get_party_by_invite_code', { p_invite_code: invite_code })
    const party = data?.[0]
    if (!party) return {}

    const over = isPartyOver(party.event_date, party.ends_at)
    const when = new Date(party.event_date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Europe/Berlin',
    })

    // Bewusst OHNE Adresse. Die Vorschau erscheint in fremden Chatverläufen und in
    // Benachrichtigungen auf gesperrten Bildschirmen; die Wohnung von jemandem gehört
    // dort nicht hin. Wer den Link öffnet, sieht sie ohnehin.
    const title = over ? `${party.title} — vorbei` : party.title
    const description = over
      ? `Diese Party am ${when} ist vorbei.`
      : party.description?.trim()
        ? party.description.trim().slice(0, 200)
        : `Du bist eingeladen — am ${when}.`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        locale: 'de_DE',
        // Schon eine absolute URL in den Supabase-Storage, also unabhängig davon, ob
        // die eigene Domain steht. Ohne Hintergrundbild bleibt das Feld leer und die
        // Vorschau zeigt nur Text — besser als ein kaputtes Bild.
        ...(party.background_url ? { images: [{ url: party.background_url }] } : {}),
      },
      twitter: {
        card: party.background_url ? 'summary_large_image' : 'summary',
        title,
        description,
      },
      // Eine Einladung hat in keinem Suchindex etwas verloren. robots.txt sagt das
      // schon, das hier sagt es noch einmal direkt auf der Seite.
      robots: { index: false, follow: false },
    }
  } catch {
    return {}
  }
}

export default async function InvitePage({ params }: { params: Promise<Params> }) {
  const { invite_code } = await params
  return <InviteScreen inviteCode={invite_code} />
}
