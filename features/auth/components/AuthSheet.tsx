'use client'

import Link from 'next/link'
import { useState } from 'react'
import { alertError } from '@/lib/utils'
import BigButton from '@/components/shared/BigButton'
import Spinner from '@/components/shared/Spinner'
import { signInWithGoogle } from '../services/auth.service'

type Props = {
  onCreateAccount: () => void
  onSignIn: () => void
  // Where to return after the OAuth round-trip (an invite link, usually).
  next?: string | null
  description?: string
}

// The start screen (App Redesign 9): the content of the shell container over the map,
// on /login and on the invite page for someone without an account.
export default function AuthSheet({ onCreateAccount, onSignIn, next, description }: Props) {
  const [pending, setPending] = useState(false)

  const handleGoogle = async () => {
    setPending(true)
    const { error } = await signInWithGoogle(next)
    // On success the browser leaves for Google, so we only get here on failure.
    if (error) {
      setPending(false)
      alertError('Anmeldung fehlgeschlagen. Bitte versuche es erneut.', error.message)
    }
  }

  return (
    <div className='flex flex-col items-center gap-3 overflow-y-auto px-5 pb-6'>
      {description && <p className='max-w-[350px] text-center text-text-2 text-text'>{description}</p>}

      <BigButton variant='main' onClick={onCreateAccount}>
        Sign up
      </BigButton>
      <BigButton variant='main' onClick={onSignIn}>
        Anmelden
      </BigButton>

      <div className='flex w-full max-w-[350px] items-center gap-2'>
        <span className='h-px flex-1 bg-divider' />
        <span className='text-text-4 text-text'>oder</span>
        <span className='h-px flex-1 bg-divider' />
      </div>

      <div className='flex w-full max-w-[350px] gap-3'>
        {/* The wait here is a redirect to Google, which is exactly the kind of
            shapeless pause the spinner exists for. */}
        <BigButton variant='white' onClick={handleGoogle} disabled={pending}>
          {pending ? <Spinner /> : 'Google'}
        </BigButton>
        {/* Shown only: Sign in with Apple needs an Apple Developer account first
            (Redesign Build Order, step 12). Disabled, so it greys out and cannot be tapped. */}
        <BigButton variant='white' disabled>
          Apple
        </BigButton>
      </div>

      {/* Dieser Bildschirm ist der einzige Ort, den JEDER Fremde zu sehen bekommt: er liegt
          auf /login und auf der Einladungsseite. Damit ist es auch die Stelle, an der
          das Impressum ohne Konto erreichbar sein muss — ein Impressum muss ständig
          verfügbar und leicht erkennbar sein, nicht erst nach der Anmeldung.

          target='_blank', damit ein Blick hinein den angefangenen Login nicht wegwirft. */}
      <div className='flex items-center justify-center gap-1 pt-2 text-text-4 text-text'>
        <Link href='/impressum' target='_blank' rel='noopener noreferrer'>
          Impressum
        </Link>
        <span aria-hidden='true'>·</span>
        <Link href='/datenschutz' target='_blank' rel='noopener noreferrer'>
          Datenschutz
        </Link>
        <span aria-hidden='true'>·</span>
        <Link href='/nutzungsbedingungen' target='_blank' rel='noopener noreferrer'>
          Nutzungsbedingungen
        </Link>
      </div>
    </div>
  )
}
