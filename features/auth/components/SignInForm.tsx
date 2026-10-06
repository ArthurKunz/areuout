'use client'

import { useState } from 'react'
import StepFrame from '@/features/create-party/StepFrame'
import Input from '@/components/shared/Input'
import InputGroup from '@/components/shared/InputGroup'
import Spinner from '@/components/shared/Spinner'
import WarningBanner from '@/components/shared/WarningBanner'
import { alertError } from '@/lib/utils'
import type { SignInProps } from '../types/auth.types'
import { sendResetPasswordEmail, signInWithPassword } from '../services/auth.service'
import { authBannerMessage } from '../services/auth-errors'

type SignInStep = 'signin' | 'forgot' | 'forgot-sent'

export default function SignInForm({ onSuccess, onClose }: SignInProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [step, setStep] = useState<SignInStep>('signin')
  const [resetEmail, setResetEmail] = useState('')
  const [saving, setSaving] = useState(false)
  // What the server said last time, held until the user changes something.
  const [warning, setWarning] = useState<string | null>(null)

  const handleSignIn = async () => {
    if (!email.trim() || !password || saving) return
    setSaving(true)
    const { error } = await signInWithPassword(email, password)
    setSaving(false)
    if (error) {
      const banner = authBannerMessage(error)
      if (banner) {
        setWarning(banner)
        return
      }
      alertError('Anmeldung fehlgeschlagen.', error.message)
      return
    }
    onSuccess()
  }

  const handleForgotPassword = async () => {
    if (!resetEmail.trim() || saving) return
    setSaving(true)
    const { error } = await sendResetPasswordEmail(resetEmail)
    setSaving(false)
    if (error) {
      const banner = authBannerMessage(error)
      if (banner) {
        setWarning(banner)
        return
      }
      alertError('Die Email konnte nicht gesendet werden.', error.message)
      return
    }
    setStep('forgot-sent')
  }

  if (step === 'forgot') {
    return (
      <StepFrame
        title='Passwort'
        onBack={() => setStep('signin')}
        button={{
          label: saving ? <Spinner /> : 'weiter',
          onClick: handleForgotPassword,
          disabled: !resetEmail.trim() || saving,
        }}
      >
        <Input
          label='Email'
          value={resetEmail}
          onChange={(value) => {
            setResetEmail(value)
            setWarning(null)
          }}
          type='email'
          autoComplete='email'
          placeholder='z.B. max@gmail.com'
          onEnter={handleForgotPassword}
        />

        {warning && <WarningBanner message={warning} />}
      </StepFrame>
    )
  }

  if (step === 'forgot-sent') {
    return (
      <StepFrame title='Passwort' onBack={onClose} button={{ label: 'fertig', onClick: onClose }}>
        <p className='max-w-[350px] text-center text-text-2 text-text'>
          Wir haben einen Link an <span className='font-semibold text-heading'>{resetEmail}</span> gesendet.
          Öffne ihn, um dir ein neues Passwort zu setzen.
        </p>
      </StepFrame>
    )
  }

  return (
    <StepFrame
      title='login'
      onBack={onClose}
      button={{
        label: saving ? <Spinner /> : 'weiter',
        onClick: handleSignIn,
        disabled: !email.trim() || !password || saving,
      }}
    >
      <InputGroup
        rows={[
          {
            label: 'Email',
            value: email,
            onChange: (value) => {
              setEmail(value)
              setWarning(null)
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
              setWarning(null)
            },
            type: 'password',
            autoComplete: 'current-password',
            placeholder: '••••••••',
            onEnter: handleSignIn,
          },
        ]}
      />

      {/* StepFrame centres its children; the wrapper puts the link under the rows'
          left edge, as in the mockup. */}
      <div className='w-full max-w-[350px]'>
        <button type='button' onClick={() => setStep('forgot')} className='px-1 text-text-3 text-text'>
          Password vergessen?
        </button>
      </div>

      {warning && <WarningBanner message={warning} />}
    </StepFrame>
  )
}
