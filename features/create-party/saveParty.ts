import { supabase } from '@/lib/supabase/client'
import { stripMetadataAndResize, BACKGROUND_MAX_EDGE } from '@/lib/image'
import { removeStorageFolder } from '@/lib/storage'
import { alertError, generateInviteCode } from '@/lib/utils'
import { BG_BUCKET } from '@/features/parties/constants/background.constants'
import type { Database } from '@/types/database.types'
import { toRpcArgs, type PartyDraft } from './draft'

type RpcArgs = Database['public']['Functions']['create_party']['Args']

// Saves the whole draft so that there is never a half-created party. The order:
// 1. The cover picture is uploaded first, before anything exists in the database. That
//    is allowed because the bucket policy only checks the first folder (auth.uid()),
//    not that a party with the second folder's id exists. If it fails, nothing is saved.
// 2. One create_party call writes the party, its polls with their options and its
//    questions in one transaction: either all of it lands or none of it.
// 3. If that call fails, the picture from step 1 would be an orphan, so its folder is
//    removed again. A retry gets a fresh partyId, and with it a fresh folder.
export async function saveParty(draft: PartyDraft, userId: string): Promise<{ ok: true; partyId: string } | { ok: false }> {
  const partyId = crypto.randomUUID()
  const inviteCode = generateInviteCode()
  // The flow only reaches the save past the cover step.
  if (!draft.cover) throw new Error('saveParty: cover is required')

  let backgroundUrl: string
  let uploaded = false
  if (draft.cover.kind === 'upload') {
    // A photo can carry the coordinates of where it was taken, and this bucket is
    // public. Never the picked file, always the re-encoded one.
    const clean = await stripMetadataAndResize(draft.cover.file, BACKGROUND_MAX_EDGE).catch(() => null)
    if (!clean) {
      alertError('Dein Hintergrundbild konnte nicht verarbeitet werden.')
      return { ok: false }
    }
    const path = `${userId}/${partyId}/background-${Date.now()}.jpg`
    const { error } = await supabase.storage.from(BG_BUCKET).upload(path, clean, { cacheControl: '3600', upsert: false })
    if (error) {
      alertError('Dein Hintergrundbild konnte nicht hochgeladen werden.', error.message)
      return { ok: false }
    }
    uploaded = true
    backgroundUrl = supabase.storage.from(BG_BUCKET).getPublicUrl(path).data.publicUrl
  } else {
    backgroundUrl = draft.cover.url
  }

  // CreatePartyArgs lets five parameters be null, which create_party accepts. The
  // generated Args type says they are non-null only because Postgres function
  // parameters carry no nullability, so this cast narrows nothing the function rejects.
  const { error } = await supabase.rpc('create_party', toRpcArgs(draft, partyId, backgroundUrl, inviteCode) as RpcArgs)

  if (error) {
    if (uploaded) await removeStorageFolder(BG_BUCKET, `${userId}/${partyId}`).catch(() => {})
    alertError('Deine Party konnte nicht erstellt werden.', error.message)
    return { ok: false }
  }
  return { ok: true, partyId }
}
