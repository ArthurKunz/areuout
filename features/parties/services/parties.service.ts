import { supabase } from '@/lib/supabase/client'
import { removeStorageFolder } from '@/lib/storage'
import type { CreatePartyPayload, PartyDetail, RsvpStatus } from '../types/parties.types'

// Through an RPC rather than the table, because this is the one read that has to
// work WITHOUT an account. Leaving `events` world-readable for its sake handed every
// party — and every invite code — to anyone who asked. The function is keyed on the
// code, which is the secret the link already rests on, so there is nothing to walk.
export async function getPartyByInviteCode(inviteCode: string): Promise<PartyDetail | null> {
  const { data, error } = await supabase.rpc('get_party_by_invite_code', { p_invite_code: inviteCode })
  if (error || !data) return null
  return (data as PartyDetail[])[0] ?? null
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
