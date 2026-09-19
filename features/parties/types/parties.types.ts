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

export type CreatePartyFormValues = {
  title: string
  description: string
  motto: string
  dresscode: string
  day: string
  month: string
  year: string
  hour: string
  minute: string
  end_hour: string
  end_minute: string
  location: string
  city: string
  max_guests: string
}

export type PartyWithCount = {
  id: string
  title: string
  event_date: string
  location: string
  invite_code: string
  attendee_count: number
  max_guests?: number | null
  background_url?: string | null
  rsvp_status?: RsvpStatus | null
  host_firstname?: string | null
  host_lastname?: string | null
  host_avatar_color?: string | null
  host_avatar_url?: string | null
  attendees?: Attendee[]
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
  location: string
  invite_code: string
  background_url?: string | null
  max_guests: number | null
}

export type Attendee = {
  user_id: string
  firstname: string | null
  lastname: string | null
  avatar_url: string | null
  avatar_color: string | null
  // 'host' never comes from the rsvps table — the host cannot RSVP to their own
  // party (the insert policy forbids it) and get_event_attendees labels them.
  status: 'going' | 'maybe' | 'not_going' | 'host'
}

export type PartyHost = {
  firstname: string | null
  lastname: string | null
  avatar_url: string | null
  avatar_color: string | null
}

export type RsvpStatus = 'going' | 'not_going' | 'maybe'

export type PoolType = 'options' | 'text_only'

export type PoolOption = {
  id: string
  pool_id: string
  label: string
  position: number
}

export type PoolResponse = {
  id: string
  pool_id: string
  user_id: string
  option_id: string | null
  text_response: string | null
  created_at: string
  firstname: string | null
  lastname: string | null
  avatar_url: string | null
  avatar_color: string | null
}

export type Pool = {
  id: string
  event_id: string
  question: string
  description: string | null
  type: PoolType
  allow_text_response: boolean
  allow_multiple: boolean
  created_at: string
  options: PoolOption[]
  responses: PoolResponse[]
}

export type PoolDraft = {
  id: string
  question: string
  description: string | null
  options: string[]
  allow_multiple: boolean
}

// Eine Frage ist eine `pools`-Zeile mit type = 'text_only', ihre Antworten sind
// `pool_responses` mit option_id = null. Warum das so liegt, steht in
// features/parties/services/questions.service.ts. Ueber dieser Grenze taucht der
// Name 'pool' nicht mehr auf: die Oberflaeche kennt nur Fragen und Antworten.
export type QuestionAnswer = PoolResponse

export type Question = {
  id: string
  event_id: string
  question: string
  description: string | null
  created_at: string
  answers: QuestionAnswer[]
}

// Ohne Optionen und ohne allow_multiple — eine Frage hat nichts zum Auswaehlen.
export type QuestionDraft = {
  id: string
  question: string
  description: string | null
}

// Die Mitbring-Liste. Ein Gegenstand traegt hoechstens eine Beanspruchung — das
// erzwingt die Datenbank ueber unique (item_id), nicht die Oberflaeche, deshalb steht
// hier ein einzelnes Objekt und keine Liste.
export type MitbringClaim = {
  item_id: string
  claimed_by: string
  firstname: string | null
  lastname: string | null
  avatar_url: string | null
  avatar_color: string | null
}

export type MitbringItem = {
  id: string
  event_id: string
  label: string
  created_at: string
  claim: MitbringClaim | null
}
