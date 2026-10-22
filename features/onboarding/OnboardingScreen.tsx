'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { alertError, sanitizeNextPath } from '@/lib/utils'
import { FitSheet } from '@/components/shell/Shell'
import { getSession } from './services/onboarding.service'
import PersonalDataForm from './components/PersonalDataForm'
import ProfilePictureForm from './components/ProfilePictureForm'

// Two steps, not three. The birthday step is gone with the column behind it: the
// app is for 16+ now, and that threshold lives in the terms rather than in a wheel.
type Step = 'name' | 'picture'

// How long a successful save waits for the client-side navigation before it reloads
// the target instead (a failed chunk load would otherwise leave the spinner forever).
const LEAVE_FALLBACK_MS = 8000

// `next` comes in as a prop for the same reason it does on the auth screen: reading it
// through useSearchParams suspends during prerendering and left the server with an
// empty body to send.
export default function OnboardingScreen({ nextParam }: { nextParam: string | null }) {
  const router = useRouter()
  // Carried over from the auth flow, so a user who started on an invite link
  // lands back on that party once their profile exists.
  const next = sanitizeNextPath(nextParam)
  const [step, setStep] = useState<Step>('name')
  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')

  const handleNameDone = (fn: string, ln: string) => {
    setFirstname(fn)
    setLastname(ln)
    setStep('picture')
  }

  // A second tap while the first insert or its navigation is still running must not
  // insert again (it answered with a 409 on profiles_pkey).
  const saving = useRef(false)
  // Cleared when the navigation succeeds, because that unmounts this screen.
  const leaveTimer = useRef<number | null>(null)
  useEffect(() => () => {
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current)
  }, [])

  const handlePictureDone = async (avatarUrl: string | null, avatarColor: string) => {
    if (saving.current) return true
    saving.current = true

    const { data: { session } } = await getSession()
    if (!session) {
      router.push('/login')
      return true
    }

    const { error } = await supabase.from('profiles').insert({
      id: session.user.id,
      firstname,
      lastname,
      avatar_url: avatarUrl,
      avatar_color: avatarColor,
    })

    // profiles_pkey is the table's only unique constraint, so 23505 means this user's
    // row already exists. It is left as it is, never overwritten.
    if (error && error.code !== '23505') {
      saving.current = false
      alertError('Dein Profil konnte nicht gespeichert werden.', error.message)
      return false
    }
    const target = next ?? '/explore'
    router.push(target)
    leaveTimer.current = window.setTimeout(() => window.location.assign(target), LEAVE_FALLBACK_MS)
    return true
  }

  return (
    <>
      {/* Over the shell's map, without navigation (App Redesign 9). */}
      <FitSheet />

      {step === 'name' && <PersonalDataForm onSuccess={handleNameDone} />}

      {step === 'picture' && (
        <ProfilePictureForm
          firstname={firstname}
          lastname={lastname}
          onSuccess={handlePictureDone}
          onClose={() => setStep('name')}
        />
      )}
    </>
  )
}
