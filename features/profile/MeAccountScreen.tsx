'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { FitSheet } from '@/components/shell/Shell'
import StepFrame from '@/features/create-party/StepFrame'
import BigButton from '@/components/shared/BigButton'
import Spinner from '@/components/shared/Spinner'
import { alertError } from '@/lib/utils'
import { removeStorageFolder } from '@/lib/storage'

// Page `Account` (App Redesign 8): the two actions that are not settings.
export default function MeAccountScreen() {
  const router = useRouter()
  // Which of the two is running, so only that button spins and neither can be pressed
  // while the other works.
  const [pending, setPending] = useState<'signout' | 'delete' | null>(null)

  const handleSignOut = async () => {
    setPending('signout')
    await supabase.auth.signOut()
    router.push('/login')
  }

  // delete_self is a SECURITY DEFINER RPC: it removes the profile row and the auth user,
  // so the sign-out afterwards only clears the local session.
  const handleDeleteAccount = async () => {
    if (!confirm('Account wirklich löschen? Alle deine Partys und Antworten gehen verloren.')) return
    setPending('delete')
    // Before the account goes, not after: the storage policies check auth.uid(), so once
    // the user is deleted nobody may touch these files again. Both folders are keyed by
    // the user id.
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await removeStorageFolder('avatars', user.id)
      await removeStorageFolder('event-backgrounds', user.id)
    }

    const { error } = await supabase.rpc('delete_self')
    if (error) {
      setPending(null)
      alertError('Dein Account konnte nicht gelöscht werden.', error.message)
      return
    }
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <FitSheet />
      <StepFrame title='Account' onBack={() => router.push('/me')} button={null}>
        <BigButton variant='white' onClick={handleSignOut} disabled={pending !== null}>
          {pending === 'signout' ? <Spinner /> : 'log out'}
        </BigButton>
        <BigButton variant='red' onClick={handleDeleteAccount} disabled={pending !== null}>
          {pending === 'delete' ? <Spinner /> : 'Account löschen'}
        </BigButton>
      </StepFrame>
    </>
  )
}
