import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'

// <Database> hängt die aus dem Schema erzeugten Typen an den Client: ab hier kennt
// jedes .from(...) seine Spalten und jedes .rpc(...) seine Argumente und
// Rückgabewerte. Die Datei types/database.types.ts lag vorher ungenutzt daneben und
// veraltete still vor sich hin — geprüft wird sie erst durch diese eine Zeile.
export const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
