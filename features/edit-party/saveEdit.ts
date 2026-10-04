import { supabase } from '@/lib/supabase/client'
import { stripMetadataAndResize, BACKGROUND_MAX_EDGE } from '@/lib/image'
import { removeStorageFileByUrl } from '@/lib/storage'
import { alertError } from '@/lib/utils'
import { BG_BUCKET } from '@/features/parties/constants/background.constants'
import type { PartyDraft } from '@/features/create-party/draft'
import type { Database } from '@/types/database.types'
import { toUpdateArgs } from './editDraft'

type RpcArgs = Database['public']['Functions']['update_party']['Args']

// Saves the edit so that there is never a half-saved party, the same order as saveParty:
// 1. A newly picked picture is uploaded first, to a new path, while the party still
//    points at the old one. If that fails, nothing has changed.
// 2. One update_party call writes the party, its polls with their options and its
//    questions in one transaction: either all of it lands or none of it.
// 3. If that call fails, the new picture is removed again and the party is exactly as
//    before. If it succeeds, the replaced own picture is unused and goes; a failed
//    cleanup there only leaves an orphan file, never a half-saved party.
export async function saveEdit(draft: PartyDraft, partyId: string, userId: string, oldBackgroundUrl: string): Promise<boolean> {
  if (!draft.cover) throw new Error('saveEdit: cover is required')

  let backgroundUrl: string
  let uploadedUrl: string | null = null
  if (draft.cover.kind === 'upload') {
    // Never the picked file, always the re-encoded one: a photo can carry where it was
    // taken, and this bucket is public.
    const clean = await stripMetadataAndResize(draft.cover.file, BACKGROUND_MAX_EDGE).catch(() => null)
    if (!clean) {
      alertError('Dein Hintergrundbild konnte nicht verarbeitet werden.')
      return false
    }
    const path = `${userId}/${partyId}/background-${Date.now()}.jpg`
    const { error } = await supabase.storage.from(BG_BUCKET).upload(path, clean, { cacheControl: '3600', upsert: false })
    if (error) {
      alertError('Dein Hintergrundbild konnte nicht hochgeladen werden.', error.message)
      return false
    }
    uploadedUrl = supabase.storage.from(BG_BUCKET).getPublicUrl(path).data.publicUrl
    backgroundUrl = uploadedUrl
  } else {
    backgroundUrl = draft.cover.url
  }

  // Same cast as in saveParty: five parameters may be null, which update_party accepts.
  const { error } = await supabase.rpc('update_party', toUpdateArgs(draft, partyId, backgroundUrl) as RpcArgs)

  if (error) {
    if (uploadedUrl) await removeStorageFileByUrl(BG_BUCKET, uploadedUrl).catch(() => {})
    alertError('Deine Änderungen konnten nicht gespeichert werden.', error.message)
    return false
  }

  // Presets are paths into /public, not into the bucket; removeStorageFileByUrl leaves
  // them alone.
  if (backgroundUrl !== oldBackgroundUrl) await removeStorageFileByUrl(BG_BUCKET, oldBackgroundUrl).catch(() => {})
  return true
}
