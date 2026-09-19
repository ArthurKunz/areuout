import { supabase } from '@/lib/supabase/client'
import type { MitbringClaim, MitbringItem } from '../types/parties.types'

type RawItemRow = {
  id: string
  event_id: string
  label: string
  created_at: string
}

const withClaims = (rows: RawItemRow[], claims: MitbringClaim[]): MitbringItem[] =>
  rows.map((row) => ({
    ...row,
    claim: claims.find((c) => c.item_id === row.id) ?? null,
  }))

export async function getPartyMitbring(partyId: string): Promise<MitbringItem[]> {
  const [{ data: itemRows }, { data: claimRows }] = await Promise.all([
    supabase
      .from('mitbring_items')
      .select('id, event_id, label, created_at')
      .eq('event_id', partyId)
      .order('created_at'),
    supabase.rpc('get_mitbring_claims_by_event', { p_event_id: partyId }),
  ])

  if (!itemRows || itemRows.length === 0) return []
  return withClaims(itemRows as RawItemRow[], (claimRows ?? []) as MitbringClaim[])
}

// Die Einladungsseite kommt nicht an die Tabelle: sie ist auf Mitglieder beschraenkt,
// und wer die Party noch nicht beantwortet hat, ist keines. Dieselbe Loesung wie bei
// den Umfragen — die Gegenstaende ueber den Invite-Code-RPC, die Beanspruchungen
// weiterhin ueber get_mitbring_claims_by_event, das einem Nicht-Mitglied nichts
// zurueckgibt. Die Liste steht also da, nur weiss noch niemand, wer was hat.
export async function getPartyMitbringByInviteCode(
  inviteCode: string,
  partyId: string
): Promise<MitbringItem[]> {
  const [{ data: itemJson }, { data: claimRows }] = await Promise.all([
    supabase.rpc('get_party_mitbring_by_invite_code', { p_invite_code: inviteCode }),
    supabase.rpc('get_mitbring_claims_by_event', { p_event_id: partyId }),
  ])

  return withClaims((itemJson ?? []) as RawItemRow[], (claimRows ?? []) as MitbringClaim[])
}

export async function createMitbringItem(eventId: string, label: string) {
  return supabase.from('mitbring_items').insert({ event_id: eventId, label })
}

// Umbenennen statt loeschen und neu anlegen, aus demselben Grund wie bei den Optionen
// einer Umfrage: die Beanspruchung haengt per ON DELETE CASCADE am Gegenstand, ein
// Loeschen risse sie also mit. Wer 'Chips' zu 'Chips und Dips' praezisiert, soll
// niemandem seine Zusage nehmen.
export async function updateMitbringItem(itemId: string, label: string) {
  return supabase.from('mitbring_items').update({ label }).eq('id', itemId)
}

export async function deleteMitbringItem(itemId: string) {
  return supabase.from('mitbring_items').delete().eq('id', itemId)
}

// event_id wird mitgeschrieben, obwohl es ueber den Gegenstand erreichbar waere: nur
// so kann unique (event_id, claimed_by) 'eine Beanspruchung pro Person und Party'
// halten. Ein falscher Wert kommt nicht durch — der zusammengesetzte Fremdschluessel
// laesst nur das Paar zu, das der Gegenstand selbst traegt.
export async function claimMitbringItem(itemId: string, eventId: string, userId: string) {
  return supabase
    .from('mitbring_claims')
    .insert({ item_id: itemId, event_id: eventId, claimed_by: userId })
}

// Ohne Angabe, WESSEN Beanspruchung: das entscheidet die Policy. Die eigene darf
// jeder loesen, jede fremde nur der Gastgeber.
export async function releaseMitbringItem(itemId: string) {
  return supabase.from('mitbring_claims').delete().eq('item_id', itemId)
}
