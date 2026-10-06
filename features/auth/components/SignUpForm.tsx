'use client'

import Link from 'next/link'
import { useState } from 'react'
import StepFrame from '@/features/create-party/StepFrame'
import InputGroup from '@/components/shared/InputGroup'
import Spinner from '@/components/shared/Spinner'
import WarningBanner from '@/components/shared/WarningBanner'
import { alertError } from '@/lib/utils'
import type { SignUpProps } from '../types/auth.types'
import { usePasswordValidation } from '../hooks/usePasswordValidation'
import { signUpWithEmail } from '../services/auth.service'
import { authBannerMessage } from '../services/auth-errors'

export default function SignUpForm({ onSuccess, onClose, onSignIn, initialEmail = '' }: SignUpProps) {
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  // What the server said last time, held until the user changes something.
  const [serverWarning, setServerWarning] = useState<string | null>(null)
  // Set alongside the 'already taken' warning, because that one warning is the only
  // one the user cannot type their way out of — it needs a door, not just a message.
  const [emailTaken, setEmailTaken] = useState(false)
  const { passwordWarning, isPasswordValid } = usePasswordValidation(password)

  // The banner only appears once there is something to complain about. An address that
  // is already taken outranks the password rules: it is the one the user cannot fix by
  // typing more, and the password may well be fine already.
  const showPasswordWarning = password.length > 0 && !isPasswordValid
  const warning = serverWarning ?? (showPasswordWarning ? passwordWarning : null)
  const canContinue = email.trim().length > 0 && isPasswordValid

  const handleSignUp = async () => {
    if (!canContinue || saving) return
    setSaving(true)
    const { data, error } = await signUpWithEmail(email, password)
    setSaving(false)

    if (error) {
      const banner = authBannerMessage(error)
      if (banner) {
        setServerWarning(banner)
        if (error.code === 'user_already_exists' || error.code === 'email_exists') setEmailTaken(true)
        return
      }
      alertError('Dein Account konnte nicht erstellt werden.', error.message)
      return
    }

    // Supabase will not say that an address is taken — that would make this form an
    // account-enumeration oracle for every user in the project. With email
    // confirmation on (mailer_autoconfirm is false here) it answers a repeat signup
    // with a DECOY user carrying an empty `identities` array and sends no session,
    // which is the documented way to spot it. Without this the flow walked on to the
    // verification step, whose code signed the user into the EXISTING account and then
    // failed on profiles_pkey at the end of onboarding.
    if (data.user?.identities?.length === 0) {
      setServerWarning('Diese Email hat schon ein Konto')
      setEmailTaken(true)
      return
    }

    // Whether a code is on its way is NOT ours to assume: it depends on the project's
    // email-confirmation setting. With confirmation ON, signUp returns a user and no
    // session, and the code is in the user's inbox. With it OFF, signUp returns a
    // SESSION and no mail is ever sent — sending them to the verification sheet then
    // parks them in front of six empty boxes forever, and 'Code erneut senden'
    // answers 200 while delivering nothing. The session is the honest signal.
    onSuccess(email, data.session !== null)
  }

  return (
    <StepFrame
      title='Sign up'
      onBack={onClose}
      button={{ label: saving ? <Spinner /> : 'weiter', onClick: handleSignUp, disabled: !canContinue || saving }}
    >
      <InputGroup
        rows={[
          {
            label: 'Email',
            value: email,
            onChange: (value) => {
              setEmail(value)
              setServerWarning(null)
              setEmailTaken(false)
            },
            type: 'email',
            autoComplete: 'email',
            placeholder: 'z.B. max@gmail.com',
          },
          {
            label: 'Password',
            value: password,
            onChange: (value) => {
              setPassword(value)
              setServerWarning(null)
              setEmailTaken(false)
            },
            type: 'password',
            autoComplete: 'new-password',
            placeholder: '••••••••',
            onEnter: handleSignUp,
          },
        ]}
      />

      {warning && <WarningBanner message={warning} />}

      {/* The address is taken — possibly by this very user, coming back around from a
          half-finished sign-up. Either way the only move left is to sign in, so the
          screen offers it instead of leaving them on a wall. */}
      {emailTaken && (
        <button type='button' onClick={onSignIn} className='px-1 text-text-3 text-text'>
          Stattdessen anmelden
        </button>
      )}

      {/* Die 16-Jahre-Grenze steht nirgends als Datenfeld — die App speichert bewusst
          kein Geburtsdatum. Sie lebt in den Nutzungsbedingungen, und das hier ist die
          Stelle, an der sie zugestimmt wird. Ohne diesen Satz trägt die Entscheidung
          gegen das Geburtsdatum nichts.

          target='_blank', damit ein Blick in die Texte das halb ausgefüllte Formular
          nicht wegwirft — der Schritt lebt im lokalen State, nicht in der URL. */}
      <p className='max-w-[350px] px-1 text-center text-text-4 text-text'>
        Mit „weiter“ bestätigst du, dass du mindestens 16 Jahre alt bist, und stimmst den{' '}
        <Link href='/nutzungsbedingungen' target='_blank' rel='noopener noreferrer' className='underline text-heading'>
          Nutzungsbedingungen
        </Link>{' '}
        und der{' '}
        <Link href='/datenschutz' target='_blank' rel='noopener noreferrer' className='underline text-heading'>
          Datenschutzerklärung
        </Link>{' '}
        zu.
      </p>
    </StepFrame>
  )
}
