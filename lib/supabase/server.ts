import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.types'

// Das Gegenstück zu client.ts für Server-Komponenten und Route-Handler.
//
// Gebaut für generateMetadata auf der Einladungsseite: die Vorschau, die WhatsApp
// oder iMessage beim Teilen eines Links zieht, entsteht auf dem Server, wo es kein
// window und keinen Browser-Client gibt.
//
// Nur der anon-Key, niemals der Service-Role-Key. Die Einladungsseite liest über
// get_party_by_invite_code, und die Funktion ist genau dafür für anon freigegeben —
// mehr Rechte braucht es hier nicht, und mehr Rechte wären hier auch falsch.
//
// setAll bleibt absichtlich leer: aus einer Server-Komponente heraus lassen sich
// keine Cookies schreiben, und dieser Client soll auch keine Sitzung erneuern. Er
// liest nur. Die Cookie-Rotation macht der Proxy.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    }
  )
}
