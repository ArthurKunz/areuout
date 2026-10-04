import { BG_BUCKET } from '@/features/parties/constants/background.constants'
import { orNull, toTimestamps, type PartyDraft } from '@/features/create-party/draft'
import type { PartyDetailRow, PartyPollRow } from '@/features/party-detail/DetailCards'
import type { Database } from '@/types/database.types'

type PollOption = { label: string }

// A saved party as the draft the Create Party pieces work on, in the viewer's time
// zone, so the same rows, wheels and sub-screens edit it.
export function toEditDraft(party: PartyDetailRow, polls: PartyPollRow[]): PartyDraft {
  const start = new Date(party.event_date)
  const end = party.ends_at ? new Date(party.ends_at) : null
  return {
    isPublic: party.is_public,
    title: party.title,
    date: { day: start.getDate(), month: start.getMonth(), year: start.getFullYear() },
    start: { hour: start.getHours(), minute: start.getMinutes() },
    endEnabled: end !== null,
    end: end ? { hour: end.getHours(), minute: end.getMinutes() } : null,
    // The host always gets the exact position and the address.
    location: { label: party.location ?? '', lat: party.lat, lng: party.lng },
    // An own picture is a public URL into the bucket; anything else is a preset path.
    cover: party.background_url.includes(`/${BG_BUCKET}/`)
      ? { kind: 'current', url: party.background_url }
      : { kind: 'preset', url: party.background_url },
    motto: party.motto,
    maxGuests: party.max_guests,
    dresscode: party.dresscode,
    description: party.description,
    polls: polls
      .filter((poll) => poll.type === 'options')
      .map((poll) => ({
        question: poll.question,
        options: (poll.options as unknown as PollOption[]).map((option) => option.label),
        allowMultiple: poll.allow_multiple,
      })),
    questions: polls.filter((poll) => poll.type === 'text_only').map((poll) => poll.question),
  }
}

type RpcArgs = Database['public']['Functions']['update_party']['Args']
type NullableArg = 'p_ends_at' | 'p_description' | 'p_motto' | 'p_dresscode' | 'p_max_guests'

// Widened like CreatePartyArgs in draft.ts: update_party takes null for these five.
export type UpdatePartyArgs = Omit<RpcArgs, NullableArg> & { [K in NullableArg]: RpcArgs[K] | null }

export function toUpdateArgs(draft: PartyDraft, partyId: string, backgroundUrl: string): UpdatePartyArgs {
  if (!draft.location) throw new Error('toUpdateArgs: location is required')
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
