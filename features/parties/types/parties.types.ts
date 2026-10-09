export type CreatePartyPayload = {
  host_id: string
  title: string
  description: string | null
  motto: string | null
  dresscode: string | null
  invite_code: string
  event_date: string
  // When the party ends. Null when the host leaves it open; the next day when the
  // end time is earlier than the start, because the party runs past midnight.
  ends_at: string | null
  location: string
  max_guests: number | null
}

export type PartyDetail = {
  id: string
  host_id: string
  title: string
  description: string | null
  motto: string | null
  dresscode: string | null
  event_date: string
  ends_at: string | null
  invite_code: string
  background_url?: string | null
  max_guests: number | null
}

export type RsvpStatus = 'going' | 'not_going' | 'maybe'
