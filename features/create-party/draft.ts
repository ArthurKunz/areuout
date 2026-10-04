import type { PartyDate } from '@/features/parties/components/PartyDateSheet'
import type { PartyTime } from '@/features/parties/components/PartyTimeSheet'
import type { Database } from '@/types/database.types'

// Everything the create flow collects, in one object. CreatePartyFlow owns it; the
// steps read and write slices of it, and toRpcArgs is the only place that turns it
// into what create_party receives.

export type PollDraft = { question: string; options: string[]; allowMultiple: boolean }

export type Cover =
  | { kind: 'preset'; url: string }
  // previewUrl comes from URL.createObjectURL and is revoked on replace and unmount.
  | { kind: 'upload'; file: File; previewUrl: string }

export type PartyDraft = {
  isPublic: boolean
  title: string
  date: PartyDate | null
  start: PartyTime | null
  endEnabled: boolean
  end: PartyTime | null
  location: { label: string; lat: number; lng: number } | null
  cover: Cover | null
  motto: string | null
  maxGuests: number | null
  dresscode: string | null
  description: string | null
  // [] means the chip was not added.
  polls: PollDraft[]
  questions: string[]
}

// The same limits create_party enforces in the database. These only shape the
// interface; the function is what actually holds them.
export const LIMITS = {
  title: 20,
  motto: 20,
  dresscode: 20,
  description: 500,
  maxGuests: 500,
  pollQuestion: 60,
  option: 30,
  minOptions: 2,
  maxOptions: 10,
  polls: 5,
  question: 60,
  questions: 5,
} as const

export function emptyDraft(): PartyDraft {
  return {
    isPublic: false,
    title: '',
    date: null,
    start: null,
    endEnabled: false,
    end: null,
    location: null,
    cover: null,
    motto: null,
    maxGuests: null,
    dresscode: null,
    description: null,
    polls: [],
    questions: [],
  }
}

// Whether each step's button may lead on.
export const canLeaveName = (d: PartyDraft) => {
  const title = d.title.trim()
  return title.length > 0 && title.length <= LIMITS.title
}
export const canLeaveTime = (d: PartyDraft) => Boolean(d.date && d.start && (!d.endEnabled || d.end))
export const canLeaveCover = (d: PartyDraft) => d.cover !== null

// React keys for the Umfrage and Frage blocks. A counter, not crypto.randomUUID, which
// is missing on the http LAN address used for phone testing.
let nextBlockKey = 0
export const newBlockKey = () => nextBlockKey++

// What Hinzufügen on the Umfrage sub-step writes: everything trimmed, a block with no
// question and no filled option dropped, and empty option rows inside a kept poll
// removed. Nothing else is dropped; pollsValid keeps the button off instead.
export function cleanPolls(polls: PollDraft[]): PollDraft[] {
  return polls
    .map((poll) => ({
      ...poll,
      question: poll.question.trim(),
      options: poll.options.map((option) => option.trim()).filter(Boolean),
    }))
    .filter((poll) => poll.question || poll.options.length > 0)
}

// Every poll that survives cleaning needs a question and at least two filled options:
// a poll with options but no question, or a question with fewer than two options,
// keeps Hinzufügen disabled.
export const pollsValid = (polls: PollDraft[]) =>
  cleanPolls(polls).every((poll) => poll.question && poll.options.length >= LIMITS.minOptions)

// Both columns are timestamptz and the database session runs in UTC, so the picked
// wall-clock time is built as a local Date and sent as an ISO string, which carries the
// offset. PartyDate's month is 0-based (it is the wheel's index), so it goes into Date
// as is. An end earlier than the start means the party runs past midnight.
export function toTimestamps(draft: PartyDraft): { eventDate: string; endsAt: string | null } {
  if (!draft.date || !draft.start) throw new Error('toTimestamps: date and start are required')
  const { day, month, year } = draft.date
  const start = new Date(year, month, day, draft.start.hour, draft.start.minute, 0, 0)

  let endsAt: string | null = null
  if (draft.endEnabled && draft.end) {
    const end = new Date(start)
    end.setHours(draft.end.hour, draft.end.minute, 0, 0)
    if (end <= start) end.setDate(end.getDate() + 1)
    endsAt = end.toISOString()
  }
  return { eventDate: start.toISOString(), endsAt }
}

type RpcArgs = Database['public']['Functions']['create_party']['Args']
type NullableArg = 'p_ends_at' | 'p_description' | 'p_motto' | 'p_dresscode' | 'p_max_guests'

// The generated Args type marks every parameter as required and non-null, because
// Postgres function parameters carry no nullability. create_party does take null for
// these five (no end, no description, motto, dresscode or guest cap), so they are
// widened here.
export type CreatePartyArgs = Omit<RpcArgs, NullableArg> & { [K in NullableArg]: RpcArgs[K] | null }

const orNull = (text: string | null) => text?.trim() || null

export function toRpcArgs(draft: PartyDraft, partyId: string, backgroundUrl: string, inviteCode: string): CreatePartyArgs {
  // The flow only reaches the save with a picked address.
  if (!draft.location) throw new Error('toRpcArgs: location is required')
  const { eventDate, endsAt } = toTimestamps(draft)

  return {
    p_id: partyId,
    p_title: draft.title.trim(),
    p_is_public: draft.isPublic,
    p_event_date: eventDate,
    p_ends_at: endsAt,
    p_location: draft.location.label,
    p_lat: draft.location.lat,
    p_lng: draft.location.lng,
    p_background_url: backgroundUrl,
    p_invite_code: inviteCode,
    p_description: orNull(draft.description),
    p_motto: orNull(draft.motto),
    p_dresscode: orNull(draft.dresscode),
    p_max_guests: draft.maxGuests,
    p_polls: draft.polls.map((poll) => ({
      question: poll.question.trim(),
      options: poll.options.map((option) => option.trim()),
      allow_multiple: poll.allowMultiple,
    })),
    p_questions: draft.questions.map((question) => question.trim()),
  }
}
