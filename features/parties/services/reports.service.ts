import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type RpcArgs = Database['public']['Functions']['submit_report']['Args']

// The four reasons reports.reason allows (CHECK reports_reason_check), in the order the
// dialog lists them. No free text (SCHEMA.md 9c).
export const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Belästigung' },
  { value: 'inappropriate', label: 'Unangemessene Inhalte' },
  { value: 'other', label: 'Etwas anderes' },
] as const

export type ReportReason = (typeof REPORT_REASONS)[number]['value']

// What is reported, exactly as submit_report checks it: a party names its host, an
// answer its author, its party and its text as shown, a person only themself.
export type ReportTarget =
  | { kind: 'party'; reportedUserId: string; eventId: string }
  | { kind: 'answer'; reportedUserId: string; eventId: string; answerText: string }
  | { kind: 'user'; reportedUserId: string }

// The generated Args mark every parameter non-null (Postgres parameters carry no
// nullability); submit_report takes null for the party of a user report and for the
// text of anything but an answer, so the call is widened as in create-party/draft.ts.
// A repeat comes back without an error: the server drops it silently.
export async function submitReport(target: ReportTarget, reason: ReportReason) {
  const args = {
    p_kind: target.kind,
    p_reported_user_id: target.reportedUserId,
    p_event_id: target.kind === 'user' ? null : target.eventId,
    p_answer_text: target.kind === 'answer' ? target.answerText : null,
    p_reason: reason,
  }
  return supabase.rpc('submit_report', args as RpcArgs)
}
