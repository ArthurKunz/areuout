'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import Avatar from '@/components/shared/Avatar'
import SettingsList from '@/components/shared/SettingsList'
import Spinner from '@/components/shared/Spinner'
import WarningBanner from '@/components/shared/WarningBanner'
import { NAME_MAX, MAX_BYTES } from '@/features/onboarding/constants/onboarding.constants'
import { alertError } from '@/lib/utils'
import { getMyProfile, updateProfileName, uploadAvatar, type Profile } from './services/profile.service'

const AVATAR_SIZE = 125

// The Profile tab (App Redesign 8): picture, name, email and one card over the map.
// Fetched in the browser on every mount, like Hosting, so it is never stale. The
// handle belongs to the container (Sheet); sub-pages are routes under /me.
export default function MeScreen() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  // What the name field shows while it is being edited; null means "show the stored name".
  const [draftName, setDraftName] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push('/login')
        return
      }
      setUserId(session.user.id)
      setEmail(session.user.email ?? '')
      setProfile(await getMyProfile(session.user.id))
      setLoading(false)
    })
  }, [router])

  const storedName = [profile?.firstname, profile?.lastname].filter(Boolean).join(' ')

  // Everything before the first space is the first name, the rest the last name.
  const commitName = async () => {
    if (draftName === null || !profile) return
    const value = draftName.trim().replace(/\s+/g, ' ')
    setDraftName(null)
    if (value === storedName) return

    const space = value.indexOf(' ')
    if (space === -1) {
      setWarning('Bitte gib Vor- und Nachnamen ein')
      return
    }
    const firstname = value.slice(0, space)
    const lastname = value.slice(space + 1)
    if (firstname.length > NAME_MAX || lastname.length > NAME_MAX) {
      setWarning(`Vor- und Nachname dürfen höchstens ${NAME_MAX} Zeichen haben`)
      return
    }

    setWarning(null)
    const { error } = await updateProfileName(userId, firstname, lastname)
    if (error) {
      alertError('Dein Name konnte nicht gespeichert werden.', error.message)
      return
    }
    setProfile({ ...profile, firstname, lastname })
  }

  const onPickFile = async (file: File | null) => {
    if (!file || !profile) return
    if (!file.type.startsWith('image/')) {
      alertError('Bitte ein Bild auswählen (JPG, PNG, …).')
      return
    }
    if (file.size > MAX_BYTES) {
      alertError('Die Datei darf höchstens 5 MB groß sein.')
      return
    }
    setUploading(true)
    const result = await uploadAvatar(userId, file, profile.avatar_url)
    setUploading(false)
    if ('error' in result) {
      alertError(result.error, result.detail)
      return
    }
    setProfile({ ...profile, avatar_url: result.url })
  }

  // flex-auto, not flex-1: the fitted container has no height of its own to share out.
  return (
    <div className='min-h-0 flex-auto overflow-y-auto px-5 pt-4 pb-25'>
      <div className='mx-auto flex w-full max-w-[350px] flex-col items-center'>
        {loading ? (
          <>
            <div className='h-31.25 w-31.25 rounded-full skeleton' />
            <div className='mt-4 h-7 w-48 rounded-full skeleton' />
            <div className='mt-2 h-4 w-56 rounded-full skeleton' />
            <div className='mt-6 h-52.5 w-full rounded-[25px] skeleton' />
          </>
        ) : (
          <>
            <button
              type='button'
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label='Profilbild ändern'
              className='relative shrink-0 rounded-full'
            >
              <Avatar
                size={AVATAR_SIZE}
                url={profile?.avatar_url ?? null}
                color={profile?.avatar_color ?? null}
                firstname={profile?.firstname ?? null}
                lastname={profile?.lastname ?? null}
              />
              {uploading && (
                <span className='absolute inset-0 flex items-center justify-center rounded-full bg-black/50'>
                  <Spinner />
                </span>
              )}
              <span className='absolute right-0 bottom-0 flex h-[45px] w-[45px] items-center justify-center rounded-full bg-button-circle text-main-white glass-control'>
                <Pencil size={24} />
              </span>
            </button>
            <input
              ref={fileRef}
              type='file'
              accept='image/*'
              hidden
              onChange={(e) => {
                onPickFile(e.target.files?.[0] ?? null)
                // Lets the same file be picked again after an error.
                e.target.value = ''
              }}
            />

            <span className='mt-4 text-heading-3 font-bold text-heading'>{storedName || 'Unbekannt'}</span>
            <span className='text-text-3 text-text'>{email}</span>

            <div className='mt-6 flex w-full flex-col items-center gap-3'>
              <SettingsList
                rows={[
                  {
                    label: 'Name',
                    value: draftName ?? storedName,
                    onChange: setDraftName,
                    onCommit: commitName,
                    placeholder: 'Vor- und Nachname',
                  },
                  { label: 'Password', onClick: () => router.push('/me/password') },
                  { label: 'Account verwalten', onClick: () => router.push('/me/account') },
                  { label: 'Rechtliches', onClick: () => router.push('/me/legal') },
                ]}
              />
              {warning && <WarningBanner message={warning} />}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
