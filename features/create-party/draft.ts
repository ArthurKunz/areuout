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
  // Edit Party only: the party's own picture already in Storage, kept as it is.
  | { kind: 'current'; url: string }

export type PartyDraft = {
  isPublic: boolean
  title: string
  date: PartyDate | null
  start: PartyTime | null
  endEnabled: boolean
  endDate: PartyDate | null
  end: PartyTime | null
  location: { label: string; lat: number; lng: number } | null
  cover: Cover | null
  motto: string | null
  maxGuests: number | null
  dresscode: string | null
  description: string | null
  // Euro, up to 2 decimals. null means no price; 0 is not a second way of saying that.
  price: number | null
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
    endDate: null,
    end: null,
    location: null,
    cover: null,
    motto: null,
    maxGuests: null,
    dresscode: null,
    description: null,
    price: null,
    polls: [],
    questions: [],
  }
}

// Whether each step's button may lead on.
export const canLeaveName = (d: PartyDraft) => {
  const title = d.title.trim()
  return title.length > 0 && title.length <= LIMITS.title
}
export const canLeaveTime = (d: PartyDraft) =>
  Boolean(d.date && d.start && (!d.endEnabled || (d.endDate && d.end))) && endProblem(d) === null
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

// One picked day plus one picked time as a local Date. PartyDate's month is 0-based (it
// is the wheel's index), so it goes into Date as is.
const at = (date: PartyDate, time: PartyTime) =>
  new Date(date.year, date.month, date.day, time.hour, time.minute, 0, 0)

// How long a party may run. Mirrors the same check in create_party and update_party --
// change one, change the other. It is there because private.party_visible_until counts
// 24 hours from the END: without a cap, an end months away would park a party on the
// map for months.
export const MAX_PARTY_DAYS = 30

// Why the chosen end cannot be saved, or null when it can. The warning under the rows
// and the disabled button both read this, so the two can never disagree. An incomplete
// end is not a problem here -- canLeaveTime holds the button for that.
export function endProblem(d: PartyDraft): string | null {
  if (!d.endEnabled || !d.date || !d.start || !d.endDate || !d.end) return null
  const start = at(d.date, d.start)
  const end = at(d.endDate, d.end)
  if (end <= start) return 'Das Ende muss nach dem Start liegen.'
  if (end.getTime() - start.getTime() > MAX_PARTY_DAYS * 24 * 60 * 60 * 1000) {
    return `Eine Party darf höchstens ${MAX_PARTY_DAYS} Tage dauern.`
  }
  return null
}

// Both columns are timestamptz and the database session runs in UTC, so the picked
// wall-clock time is built as a local Date and sent as an ISO string, which carries the
// offset. The end is its own picked day since step 11c: before that it was a clock time
// only, and an end earlier than the start was silently read as the next day.
export function toTimestamps(draft: PartyDraft): { eventDate: string; endsAt: string | null } {
  if (!draft.date || !draft.start) throw new Error('toTimestamps: date and start are required')
  const start = at(draft.date, draft.start)
  const endsAt =
    draft.endEnabled && draft.endDate && draft.end ? at(draft.endDate, draft.end).toISOString() : null
  return { eventDate: start.toISOString(), endsAt }
}

type RpcArgs = Database['public']['Functions']['create_party']['Args']
type NullableArg = 'p_ends_at' | 'p_description' | 'p_motto' | 'p_dresscode' | 'p_max_guests' | 'p_price'

// The generated Args type marks every parameter as required and non-null, because
// Postgres function parameters carry no nullability. create_party does take null for
// these six (no end, no description, motto, dresscode, guest cap or price), so they
// are widened here. p_price is generated optional because it has a DEFAULT; it is
// always sent anyway, so that it loses the `?` here is the shape we want.
export type CreatePartyArgs = Omit<RpcArgs, NullableArg> & { [K in NullableArg]: RpcArgs[K] | null }

export const orNull = (text: string | null) => text?.trim() || null

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
    p_price: draft.price,
    p_polls: draft.polls.map((poll) => ({
      question: poll.question.trim(),
      options: poll.options.map((option) => option.trim()),
      allow_multiple: poll.allowMultiple,
    })),
    p_questions: draft.questions.map((question) => question.trim()),
  }
}
