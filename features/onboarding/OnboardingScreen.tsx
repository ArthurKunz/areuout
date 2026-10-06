'use client'

import { useState } from 'react'
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

  const handlePictureDone = async (avatarUrl: string | null, avatarColor: string) => {
    const { data: { session } } = await getSession()
    if (!session) {
      router.push('/login')
      return
    }

    const { error } = await supabase.from('profiles').insert({
      id: session.user.id,
      firstname,
      lastname,
      avatar_url: avatarUrl,
      avatar_color: avatarColor,
    })

    if (error) {
      alertError('Dein Profil konnte nicht gespeichert werden.', error.message)
      return
    }
    router.push(next ?? '/explore')
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
