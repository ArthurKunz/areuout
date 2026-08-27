import { supabase } from '@/lib/supabase/client'
import { isPartyOver } from '@/lib/utils'
import { removeStorageFolder } from '@/lib/storage'
import type { CreatePartyPayload, PartyWithCount, PartyDetail, Attendee, PartyHost, RsvpStatus } from '../types/parties.types'

export async function createParty(payload: CreatePartyPayload) {
  return supabase.from('events').insert(payload).select('id, invite_code').single()
}

// How many faces the card stacks. The list is cut here rather than in the screen so
// nothing downstream has to know the number.
const ATTENDEE_PREVIEW = 10

// Two requests for the whole list instead of two PER party. This used to be a loop:
// ten parties meant twenty round trips before the screen could paint, and on a phone
// every one of them is a real network hop that queues behind the others.
//
// get_rsvp_counts_for_events and get_event_attendees_for_events are line-for-line
// derived from their single-party versions — same statuses, same host special case,
// same ordering — so the cards show exactly what they showed before.
async function loadCountsAndAttendees(eventIds: string[]): Promise<{
  counts: Map<string, number>
  attendees: Map<string, Attendee[]>
}> {
  const counts = new Map<string, number>()
  const attendees = new Map<string, Attendee[]>()
  if (eventIds.length === 0) return { counts, attendees }

  const [countResult, attendeeResult] = await Promise.all([
    supabase.rpc('get_rsvp_counts_for_events', { p_event_ids: eventIds }),
    supabase.rpc('get_event_attendees_for_events', { p_event_ids: eventIds }),
  ])

  // A party nobody has answered yet is absent from the counts altogether, which is why
  // the readers below fall back to 0 instead of trusting the map to hold every id.
  for (const row of countResult.data ?? []) counts.set(row.event_id, row.attendee_count)

  // The RPC orders within each party the way the old one did — host, going, maybe,
  // not_going — so taking the first ten as they arrive is the same slice as before.
  for (const row of attendeeResult.data ?? []) {
    const attendee: Attendee = {
      user_id: row.user_id,
      firstname: row.firstname,
      lastname: row.lastname,
      avatar_url: row.avatar_url,
      avatar_color: row.avatar_color,
      status: row.status as Attendee['status'],
    }
    const list = attendees.get(row.event_id)
    if (!list) {
      attendees.set(row.event_id, [attendee])
    } else if (list.length < ATTENDEE_PREVIEW) {
      list.push(attendee)
    }
  }

  return { counts, attendees }
}

const AVATAR_COLORS = ['#FF0090', '#A336FF', '#161BFA', '#5684FF', '#AE4FFF', '#D47AFF', '#E224A1']

function hostColor(hostId: string): string {
  const sum = hostId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

export async function getHostedParties(userId: string): Promise<PartyWithCount[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, title, event_date, ends_at, location, invite_code, background_url, max_guests')
    .eq('host_id', userId)
    .order('event_date', { ascending: true })
  if (error || !data) return []

  // A finished party drops out HERE rather than in the screen, so the RPCs below never
  // ask about a party nobody is going to see. The row itself stays in the database:
  // the invite link keeps working and the host keeps their guest list.
  const upcoming = data.filter((e) => !isPartyOver(e.event_date, e.ends_at))
  if (upcoming.length === 0) return []

  // Two requests for the whole tab. The counts already include the host themselves.
  const { counts, attendees } = await loadCountsAndAttendees(upcoming.map((e) => e.id))

  return upcoming.map((e) => ({
    id: e.id,
    title: e.title,
    event_date: e.event_date,
    location: e.location,
    invite_code: e.invite_code,
    background_url: e.background_url,
    max_guests: e.max_guests,
    attendee_count: counts.get(e.id) ?? 0,
    attendees: attendees.get(e.id) ?? [],
  }))
}

export async function getAttendedParties(userId: string): Promise<PartyWithCount[]> {
  // 'going', 'not_going' and 'maybe' RSVPs all appear under "Ich bin Gast"
  const { data, error } = await supabase
    .from('rsvps')
    // 'parties:events(...)': the table is still named `events` and PostgREST resolves an
    // embed by the real table name, so a plain `parties(...)` matched nothing and every
    // one of these requests came back 400 (PGRST200) — the guest tab never loaded.
    .select('status, parties:events(id, title, event_date, ends_at, location, invite_code, background_url, host_id, max_guests)')
    .eq('user_id', userId)
  if (error || !data) return []

  const rows = data
    // You are never a guest at your own party — it belongs on the 'Gastgeber' tab only,
    // and a party that is over belongs on neither.
    .filter(
      (r) =>
        r.parties !== null &&
        r.parties.host_id !== userId &&
        !isPartyOver(r.parties.event_date, r.parties.ends_at)
    )
    .map((r) => ({ status: r.status as RsvpStatus, party: r.parties! }))
    .sort((a, b) => new Date(a.party.event_date).getTime() - new Date(b.party.event_date).getTime())

  if (rows.length === 0) return []

  const eventIds = rows.map(({ party }) => party.id)

  // Three requests for the whole tab, whatever its length. get_host_info_for_events is
  // get_event_host for many parties at once; it additionally requires membership, which
  // every party here satisfies by construction — they all come from this user's own
  // RSVPs. All three are SECURITY DEFINER, so they see past profiles RLS.
  const [{ counts, attendees }, hostResult] = await Promise.all([
    loadCountsAndAttendees(eventIds),
    supabase.rpc('get_host_info_for_events', { p_event_ids: eventIds }),
  ])

  const hosts = new Map<string, PartyHost>()
  for (const row of hostResult.data ?? []) {
    hosts.set(row.event_id, {
      firstname: row.firstname,
      lastname: row.lastname,
      avatar_url: row.avatar_url,
      avatar_color: row.avatar_color,
    })
  }

  return rows.map(({ status, party }) => {
    const host = hosts.get(party.id) ?? null
    return {
      id: party.id,
      title: party.title,
      event_date: party.event_date,
      location: party.location,
      invite_code: party.invite_code,
      background_url: party.background_url,
      max_guests: party.max_guests,
      attendee_count: counts.get(party.id) ?? 0,
      attendees: attendees.get(party.id) ?? [],
      rsvp_status: status,
      host_firstname: host?.firstname ?? null,
      host_lastname: host?.lastname ?? null,
      host_avatar_color: host?.avatar_color ?? hostColor(party.host_id),
      host_avatar_url: host?.avatar_url ?? null,
    }
  })
}

const PARTY_DETAIL_COLUMNS = 'id, host_id, title, description, event_date, ends_at, location, invite_code, background_url, max_guests'

export async function getPartyById(partyId: string): Promise<PartyDetail | null> {
  const { data, error } = await supabase
    .from('events')
    .select(PARTY_DETAIL_COLUMNS)
    .eq('id', partyId)
    .maybeSingle()
  if (error || !data) return null
  return data
}

// Through an RPC rather than the table, because this is the one read that has to
// work WITHOUT an account. Leaving `events` world-readable for its sake handed every
// party — and every invite code — to anyone who asked. The function is keyed on the
// code, which is the secret the link already rests on, so there is nothing to walk.
export async function getPartyByInviteCode(inviteCode: string): Promise<PartyDetail | null> {
  const { data, error } = await supabase.rpc('get_party_by_invite_code', { p_invite_code: inviteCode })
  if (error || !data) return null
  return (data as PartyDetail[])[0] ?? null
}

// Die Fassung für die Einladungsseite. Sie sucht über den Einladungscode statt über
// die Party-UUID, weil der Code das Geheimnis ist und die UUID nicht: Letztere steht in
// jeder Hintergrundbild-Adresse. Ohne diesen Weg bekam jeder, der irgendwo eine
// Party-UUID aufschnappte, ohne Konto den vollen Namen des Gastgebers.
export async function getPartyHostByInviteCode(inviteCode: string): Promise<PartyHost | null> {
  const { data, error } = await supabase.rpc('get_event_host_by_invite_code', { p_invite_code: inviteCode })
  if (error || !data || data.length === 0) return null
  return data[0] as PartyHost
}

export async function getPartyHost(partyId: string): Promise<PartyHost | null> {
  const { data, error } = await supabase.rpc('get_event_host', { p_event_id: partyId })
  if (error || !data || data.length === 0) return null
  return data[0] as PartyHost
}

// The invite page's version: keyed on the code rather than on membership, so someone
// who has the link but has not answered yet still sees who is coming. get_event_attendees
// itself stays members-only — this is the one page where holding the link IS the claim.
export async function getPartyAttendeesByInviteCode(inviteCode: string): Promise<Attendee[]> {
  const { data, error } = await supabase.rpc('get_event_attendees_by_invite_code', { p_invite_code: inviteCode })
  if (error || !data) return []
  return data as Attendee[]
}

export async function getPartyAttendees(partyId: string): Promise<Attendee[]> {
  const { data, error } = await supabase.rpc('get_event_attendees', { p_event_id: partyId })
  if (error || !data) return []
  return data as Attendee[]
}

// Gleiche Begründung wie bei getPartyHostByInviteCode: auf der Einladungsseite ist der
// Code der Schlüssel, nicht die UUID.
export async function getRsvpCountsByStatusByInviteCode(inviteCode: string): Promise<{ going: number; maybe: number; not_going: number }> {
  const { data } = await supabase.rpc('get_rsvp_counts_by_status_by_invite_code', { p_invite_code: inviteCode })
  const row = data?.[0]
  return { going: row?.going_count ?? 0, maybe: row?.maybe_count ?? 0, not_going: row?.not_going_count ?? 0 }
}

export async function getRsvpCountsByStatus(partyId: string): Promise<{ going: number; maybe: number; not_going: number }> {
  const { data } = await supabase.rpc('get_rsvp_counts_by_status', { p_event_id: partyId })
  const row = data?.[0]
  return { going: row?.going_count ?? 0, maybe: row?.maybe_count ?? 0, not_going: row?.not_going_count ?? 0 }
}

export async function getMyRsvpStatus(partyId: string, userId: string): Promise<RsvpStatus | null> {
  const { data, error } = await supabase
    .from('rsvps')
    .select('status')
    .eq('event_id', partyId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data.status as RsvpStatus
}

export async function setRsvp(partyId: string, userId: string, status: RsvpStatus) {
  return supabase
    .from('rsvps')
    .upsert({ event_id: partyId, user_id: userId, status }, { onConflict: 'event_id,user_id' })
}

// The host's edit screen writes the whole form at once; RLS restricts it to their
// own party, so no host_id check is needed here.
export async function updateParty(partyId: string, patch: Partial<CreatePartyPayload>) {
  return supabase.from('events').update(patch).eq('id', partyId)
}

// Options and responses go with it by cascade.
export async function deletePool(poolId: string) {
  return supabase.from('pools').delete().eq('id', poolId)
}

// The background lives at {host_id}/{party_id}/background.ext and is NOT removed by
// deleting the row — 41 files from deleted parties had piled up that way. The row goes
// first because that is what the host asked for; a failed cleanup afterwards only
// leaves the orphan we used to leave every time anyway.
export async function deleteParty(partyId: string, hostId: string) {
  const result = await supabase.from('events').delete().eq('id', partyId)
  if (!result.error) await removeStorageFolder('event-backgrounds', `${hostId}/${partyId}`)
  return result
}

export async function deleteRsvp(partyId: string, userId: string) {
  return supabase.from('rsvps').delete().eq('event_id', partyId).eq('user_id', userId)
}
