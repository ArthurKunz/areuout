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
import { isNativeLogin, revokeAppleAuthorization } from '@/features/auth/services/auth.service'
import { forgetThisDevice } from '@/features/push/push.service'

// Page `Account` (App Redesign 8): the two actions that are not settings.
export default function MeAccountScreen() {
  const router = useRouter()
  // Which of the two is running, so only that button spins and neither can be pressed
  // while the other works.
  const [pending, setPending] = useState<'signout' | 'delete' | null>(null)

  const handleSignOut = async () => {
    setPending('signout')
    // While still signed in, or RLS would not let the row go.
    await forgetThisDevice()
    await supabase.auth.signOut()
    router.push('/login')
  }

  // delete_self is a SECURITY DEFINER RPC: it removes the profile row and the auth user,
  // so the sign-out afterwards only clears the local session.
  const handleDeleteAccount = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    // An Apple user in the iOS app confirms with Apple once more, so the authorization
    // can be revoked (App Store 5.1.1(v)). The website has no Apple sign-in yet (step 4.10).
    const appleRevoke = isNativeLogin() && !!user?.identities?.some((i) => i.provider === 'apple')
    const question = 'Account wirklich löschen? Alle deine Partys und Antworten gehen verloren.'
    const appleNote = '\n\nDanach bestätigst du einmal mit Apple, damit areuout auch dort abgemeldet wird.'
    if (!confirm(appleRevoke ? question + appleNote : question)) return
    setPending('delete')

    if (appleRevoke) {
      let failed = false
      try {
        failed = !!(await revokeAppleAuthorization()).error
      } catch (error) {
        // Closing the Apple sheet is a choice: nothing is deleted, nothing is said.
        if ((error as { code?: string }).code === 'USER_CANCELLED') {
          setPending(null)
          return
        }
        failed = true
      }
      // Deleting must not depend on Apple being reachable. Cancel deletes nothing, and
      // tapping again tries Apple again.
      if (
        failed &&
        !confirm(
          'Bei Apple hat das gerade nicht geklappt. Trotzdem löschen? Die Anmeldung mit Apple kannst du danach selbst in den iPhone-Einstellungen unter „Mit Apple anmelden“ beenden.',
        )
      ) {
        setPending(null)
        return
      }
    }

    // Before the account goes, not after: the storage policies check auth.uid(), so once
    // the user is deleted nobody may touch these files again. Both folders are keyed by
    // the user id.
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
