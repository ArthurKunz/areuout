import { supabase } from '@/lib/supabase/client'
import { removeStorageFileByUrl } from '@/lib/storage'
import { stripMetadataAndResize, AVATAR_MAX_EDGE } from '@/lib/image'
import { BUCKET } from '@/features/onboarding/constants/onboarding.constants'

export type Profile = {
  firstname: string | null
  lastname: string | null
  avatar_url: string | null
  avatar_color: string
}

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('firstname, lastname, avatar_url, avatar_color')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data
}

export async function updateProfileName(userId: string, firstname: string, lastname: string) {
  return supabase.from('profiles').update({ firstname, lastname }).eq('id', userId)
}

export async function updateProfileAvatar(userId: string, avatarUrl: string) {
  return supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId)
}

// Uploads a new profile picture and points the row at it. The picked file never reaches
// the bucket unchanged (metadata stripped, resized, as in onboarding), and the old file
// goes only once the row points at the new one, so a failed update cannot leave the
// profile aimed at a file that no longer exists. Returns the new URL, or the German
// error text to show.
export async function uploadAvatar(
  userId: string,
  file: File,
  previousUrl: string | null,
): Promise<{ url: string } | { error: string; detail?: string }> {
  let clean: File
  try {
    clean = await stripMetadataAndResize(file, AVATAR_MAX_EDGE)
  } catch {
    return { error: 'Dieses Bild konnte nicht verarbeitet werden. Versuch es mit einem anderen.' }
  }

  const path = `${userId}/avatar-${Date.now()}.jpg`
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, clean, { cacheControl: '3600', upsert: false })
  if (uploadError) return { error: 'Dein Bild konnte nicht hochgeladen werden.', detail: uploadError.message }

  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  const { error } = await updateProfileAvatar(userId, url)
  if (error) return { error: 'Dein Profilbild konnte nicht gespeichert werden.', detail: error.message }

  await removeStorageFileByUrl(BUCKET, previousUrl)
  return { url }
}
