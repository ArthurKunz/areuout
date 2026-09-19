import { supabase } from '@/lib/supabase/client'
import type { Question, QuestionAnswer } from '../types/parties.types'

// Die Fragen liegen auf den Tabellen der Umfragen: eine Frage ist eine `pools`-Zeile
// mit type = 'text_only', eine Antwort eine `pool_responses`-Zeile mit option_id =
// null. Das ist keine Verlegenheitsloesung, sondern die Stelle, an der die Datenbank
// bereits genau das tat, was die Fragen brauchen:
//
//   - pools_type_check erlaubt 'text_only' seit der ersten Migration
//   - pool_responses.text_response gibt es samt Laengen-CHECK
//   - get_pool_responses_by_event liefert den Freitext mit Namen und Avatar und
//     prueft die Mitgliedschaft in der Funktion selbst (security definer umgeht RLS)
//   - set_single_pool_response klammert Loeschen und Neuschreiben in EINE
//     Transaktion — genau das, was 'Antwort aendern' heisst
//   - der Trigger pool_responses_single_answer haelt eine Antwort pro Person fest,
//     weil allow_multiple hier immer false ist
//   - pool_responses haengt per ON DELETE CASCADE an pools, eine geloeschte Frage
//     nimmt ihre Antworten also mit
//
// Eigene Tabellen haetten zehn RLS-Policies, zwei RPCs und einen Trigger gekostet,
// um am Ende dasselbe zu koennen. Der Preis dieser Entscheidung ist der Filter auf
// `type`: er steht hier und in pools.service.ts, sonst nirgends. Faellt er weg,
// erscheint eine Frage als leere Umfrage im Umfragen-Abschnitt.
const QUESTION_TYPE = 'text_only'

type RawQuestionRow = {
  id: string
  event_id: string
  question: string
  description: string | null
  created_at: string | null
}

const toQuestion = (row: RawQuestionRow, answers: QuestionAnswer[]): Question => ({
  id: row.id,
  event_id: row.event_id,
  question: row.question,
  description: row.description,
  created_at: row.created_at ?? '',
  answers: answers.filter((a) => a.pool_id === row.id),
})

export async function getPartyQuestions(partyId: string): Promise<Question[]> {
  const [{ data: questionRows }, { data: answerRows }] = await Promise.all([
    supabase
      .from('pools')
      .select('id, event_id, question, description, created_at')
      .eq('event_id', partyId)
      .eq('type', QUESTION_TYPE)
      .order('created_at'),
    supabase.rpc('get_pool_responses_by_event', { p_event_id: partyId }),
  ])

  if (!questionRows || questionRows.length === 0) return []

  const answers = (answerRows ?? []) as QuestionAnswer[]
  return (questionRows as RawQuestionRow[]).map((row) => toQuestion(row, answers))
}

// Die Invite-Seite kommt nicht an die Tabelle: sie ist auf Mitglieder beschraenkt,
// und wer die Party noch nicht beantwortet hat, ist keines. Dieselbe Loesung wie bei
// den Umfragen — die Fragen ueber den Invite-Code-RPC, die Antworten weiterhin ueber
// get_pool_responses_by_event, das einem Nicht-Mitglied nichts zurueckgibt.
export async function getPartyQuestionsByInviteCode(
  inviteCode: string,
  partyId: string
): Promise<Question[]> {
  const [{ data: poolJson }, { data: answerRows }] = await Promise.all([
    supabase.rpc('get_party_pools_by_invite_code', { p_invite_code: inviteCode }),
    supabase.rpc('get_pool_responses_by_event', { p_event_id: partyId }),
  ])

  const rows = (poolJson ?? []) as (RawQuestionRow & { type: string })[]
  const answers = (answerRows ?? []) as QuestionAnswer[]

  return rows.filter((row) => row.type === QUESTION_TYPE).map((row) => toQuestion(row, answers))
}

export async function createQuestion(payload: {
  event_id: string
  question: string
  description: string | null
}) {
  return supabase
    .from('pools')
    .insert({
      ...payload,
      type: QUESTION_TYPE,
      allow_text_response: true,
      // Eine Antwort pro Person. Daran haengt der Trigger, der genau das erzwingt.
      allow_multiple: false,
    })
    .select('id')
    .single()
}

export async function updateQuestion(
  questionId: string,
  patch: { question: string; description: string | null }
) {
  return supabase.from('pools').update(patch).eq('id', questionId)
}
