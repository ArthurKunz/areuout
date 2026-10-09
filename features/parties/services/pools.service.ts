import { supabase } from '@/lib/supabase/client'

export type DetailOption = { option_id: string; label: string }
export type DetailResponse = {
  option_id: string | null
  user_id: string
  firstname: string | null
  lastname: string | null
  avatar_url: string | null
  avatar_color: string | null
  text_response: string | null
}
export type DetailPoll = {
  pool_id: string
  question: string
  allow_multiple: boolean
  options: DetailOption[]
  responses: DetailResponse[]
}

// The redesign's detail: polls and questions with every vote and answer, from
// get_party_poll_data. On a private party a stranger gets no rows at all; the function
// decides that, not the screen. Polls and questions share the table and are told apart
// here, by type.
export async function getDetailPolls(partyId: string) {
  const { data, error } = await supabase.rpc('get_party_poll_data', { p_event_id: partyId })
  if (error) return { data: null, error }
  const rows = data.map((row) => ({
    type: row.type,
    pool_id: row.pool_id,
    question: row.question,
    allow_multiple: row.allow_multiple,
    options: row.options as unknown as DetailOption[],
    responses: row.responses as unknown as DetailResponse[],
  }))
  return {
    data: {
      polls: rows.filter((row) => row.type === 'options'),
      questions: rows.filter((row) => row.type === 'text_only'),
    },
    error: null,
  }
}

// Single-answer polls: one row per user, replaced when they change their mind.
//
// Das lief bis zum 27.08.2026 als delete gefolgt von insert — zwei getrennte Anfragen,
// also zwei Transaktionen. Das Löschen war committet, bevor das Einfügen überhaupt
// losging; scheiterte es dann, war die alte Antwort weg und die neue nie da. Mit einer
// Fixture nachgestellt: Antwort gesetzt, auf eine Option einer FREMDEN Umfrage
// gewechselt, Fremdschlüssel lehnt ab — übrig blieben null Antworten.
//
// set_single_pool_response klammert beides in eine Transaktion. Die Funktion läuft als
// security invoker, RLS gilt also unverändert; sie steuert nichts bei ausser der
// Klammer. Die user_id kommt dort aus auth.uid() und nicht mehr als Parameter — was
// nicht übergeben wird, kann auch nicht falsch übergeben werden.
export async function upsertPoolResponse(
  poolId: string,
  optionId: string | null,
  textResponse: string | null
) {
  // Der Cast ist nicht Schlamperei, sondern eine Grenze des Typgenerators: Postgres
  // notiert an einem Funktionsargument nur den Typ (uuid, text), nicht ob NULL erlaubt
  // ist — supabase gen types schreibt deshalb `string`. Beide Argumente DUERFEN aber
  // null sein: eine Auswahlantwort hat keinen Freitext, eine Freitextantwort keine
  // Option. Der Wert geht als JSON-null raus, was die Funktion genau so erwartet.
  return supabase.rpc('set_single_pool_response', {
    p_pool_id: poolId,
    p_option_id: optionId as string,
    p_text_response: textResponse as string,
  })
}

// Multi-answer polls: each option is toggled on its own.
export async function addPoolResponse(poolId: string, userId: string, optionId: string) {
  return supabase
    .from('pool_responses')
    .insert({ pool_id: poolId, user_id: userId, option_id: optionId, text_response: null })
}

export async function removePoolResponse(poolId: string, userId: string, optionId: string) {
  return supabase
    .from('pool_responses')
    .delete()
    .eq('pool_id', poolId)
    .eq('user_id', userId)
    .eq('option_id', optionId)
}
