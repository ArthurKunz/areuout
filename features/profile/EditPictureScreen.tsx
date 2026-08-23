'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil, User } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import Avatar from '@/components/shared/Avatar'
import Spinner from '@/components/shared/Spinner'
import UnsavedChangesDialog from '@/components/shared/UnsavedChangesDialog'
import { alertError } from '@/lib/utils'
import { removeStorageFileByUrl } from '@/lib/storage'
import { AVATAR_COLORS, BUCKET, MAX_BYTES } from '@/features/onboarding/constants/onboarding.constants'
import { stripMetadataAndResize, AVATAR_MAX_EDGE } from '@/lib/image'
import {
  getMyProfile,
  updateProfileAvatar,
  updateProfileAvatarColor,
  type Profile,
} from './services/profile.service'
import SettingsPage, { saveButtonClass } from './components/SettingsPage'

export default function EditPictureScreen() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [color, setColor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push('/login')
        return
      }
      const myProfile = await getMyProfile(session.user.id)
      setUserId(session.user.id)
      setProfile(myProfile)
      // Someone already using initials starts with their colour marked.
      if (myProfile && !myProfile.avatar_url) setColor(myProfile.avatar_color)
      setLoading(false)
    })
  }, [router])

  const onPickFile = (picked: File | null) => {
    if (!picked) return
    if (!picked.type.startsWith('image/')) {
      alertError('Bitte ein Bild auswählen (JPG, PNG, …).')
      return
    }
    if (picked.size > MAX_BYTES) {
      alertError('Die Datei darf höchstens 5 MB groß sein.')
      return
    }
    // Photo and initials are alternatives, so picking one drops the other.
    setColor(null)
    setFile(picked)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(picked)
    })
  }

  const selectColor = (value: string) => {
    setColor(value)
    setFile(null)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  const canSave = !!file || (!!color && (color !== profile?.avatar_color || !!profile?.avatar_url))

  // Set when the back button is tapped with something worth saving still on screen.
  const [askLeave, setAskLeave] = useState(false)

  const handleBack = () => {
    if (canSave) {
      setAskLeave(true)
      return
    }
    router.push('/profile')
  }

  const handleSave = async () => {
    if (!canSave || !userId) return
    setSaving(true)

    if (color) {
      const { error } = await updateProfileAvatarColor(userId, color as string)
      if (error) {
        setSaving(false)
        alertError('Deine Farbe konnte nicht gespeichert werden.', error.message)
        return
      }
      // Initials replace the photo, so the file it used to point at has to go.
      await removeStorageFileByUrl(BUCKET, profile?.avatar_url)
      setSaving(false)
      router.push('/profile')
      return
    }

    // Same as in onboarding: the picked file never reaches the bucket unchanged.
    let clean: File
    try {
      clean = await stripMetadataAndResize(file!, AVATAR_MAX_EDGE)
    } catch {
      setSaving(false)
      alertError('Dieses Bild konnte nicht verarbeitet werden. Versuch es mit einem anderen.')
      return
    }

    const path = `${userId}/avatar-${Date.now()}.jpg`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, clean, { cacheControl: '3600', upsert: false })
    if (uploadError) {
      setSaving(false)
      alertError('Dein Bild konnte nicht hochgeladen werden.', uploadError.message)
      return
    }

    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    const previousUrl = profile?.avatar_url
    const { error } = await updateProfileAvatar(userId, publicUrl)
    if (error) {
      setSaving(false)
      alertError('Dein Profilbild konnte nicht gespeichert werden.', error.message)
      return
    }
    // Only once the row points at the new file — otherwise a failed update would
    // leave the profile aimed at something that no longer exists.
    await removeStorageFileByUrl(BUCKET, previousUrl)
    setSaving(false)
    router.push('/profile')
  }

  // The big circle is a live preview of whatever is currently chosen.
  const shownPhoto = color ? null : (previewUrl ?? profile?.avatar_url ?? null)

  return (
    <SettingsPage title='Profilbild' fill onBack={handleBack}>
      {loading ? (
        <>
          <div className='flex justify-center'>
            <div className='h-43.75 w-43.75 rounded-full skeleton' />
          </div>
          <div className='mt-6 grid grid-cols-3 gap-3'>
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className='flex flex-col items-center gap-2'>
                <div className='h-22.5 w-22.5 rounded-full skeleton' />
                <div className='h-6 w-6 rounded-full skeleton' />
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
      {/* Photo first: the circle is the file input, the pencil badge is decoration
            on top of it, and it previews whatever is currently chosen. */}
        <label className='flex cursor-pointer justify-center'>
          <div className='group relative'>
            {shownPhoto || color ? (
              <Avatar
                size={175}
                url={shownPhoto}
                color={color}
                firstname={profile?.firstname ?? null}
                lastname={profile?.lastname ?? null}
                className='backdrop-blur-xl transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95'
              />
            ) : (
              <div className='flex h-43.75 w-43.75 items-center justify-center rounded-full bg-secondary backdrop-blur-xl transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95'>
                <User size={72} strokeWidth={1.5} className='text-subheading' />
              </div>
            )}
            <span className='absolute bottom-1 right-1 flex h-11.25 w-11.25 items-center justify-center rounded-full bg-sheet transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] group-active:scale-95'>
              <Pencil size={18} strokeWidth={2.5} className='text-sheet-heading' />
            </span>
          </div>
          <input
            type='file'
            accept='image/*'
            className='hidden'
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {/* …or initials on one of the nine party colours. */}
        <div className='mt-6 grid grid-cols-3 gap-3'>
          {AVATAR_COLORS.map((value) => (
            <button key={value} type='button' onClick={() => selectColor(value)} className='flex flex-col items-center gap-2'>
              <Avatar
                size={90}
                url={null}
                color={value}
                firstname={profile?.firstname ?? null}
                lastname={profile?.lastname ?? null}
                className='transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95'
              />
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full backdrop-blur-xl transition-colors duration-200 ${
                  color === value ? 'bg-link' : 'border border-white/30'
                }`}
              >
                {color === value && <Check size={14} strokeWidth={3} className='text-white animate-fade-in-up' />}
              </span>
            </button>
          ))}
        </div>
        </>
      )}

      <button type='button' onClick={handleSave} disabled={loading || !canSave || saving} className={`${saveButtonClass} mt-4`}>
        {saving ? <Spinner /> : 'speichern'}
      </button>

      {askLeave && (
        <UnsavedChangesDialog
          saving={saving}
          onSave={handleSave}
          onDiscard={() => router.push('/profile')}
          onCancel={() => setAskLeave(false)}
        />
      )}
    </SettingsPage>
  )
}
