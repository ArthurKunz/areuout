'use client'

import { useState } from 'react'
import StepFrame from '@/features/create-party/StepFrame'
import Input from '@/components/shared/Input'
import Spinner from '@/components/shared/Spinner'
import WarningBanner from '@/components/shared/WarningBanner'
import { alertError } from '@/lib/utils'
import type { VerifyProps } from '../types/auth.types'
import { OTP_LENGTH } from '../constants/auth.constants'
import { resendSignupOtp, verifySignupOtp } from '../services/auth.service'
import { authBannerMessage } from '../services/auth-errors'

// No back button (App Redesign 9): the code is the only way forward from here.
export default function VerifyOtpForm({ email, onSuccess }: VerifyProps) {
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  const verify = async (value: string) => {
    if (value.length !== OTP_LENGTH || saving) return
    setSaving(true)
    setWarning(null)
    const { error } = await verifySignupOtp(email, value)
    if (error) {
      setSaving(false)
      // Emptying the field both readies the next attempt and stops the auto-submit
      // from firing again on the same wrong digits.
      setCode('')
      const banner = authBannerMessage(error)
      if (banner) {
        setWarning(banner)
        return
      }
      alertError('Der Code konnte nicht geprüft werden.', error.message)
      return
    }
    onSuccess()
  }

  // Digits only, and six digits is the whole answer: the code is verified the moment it
  // is complete, typed or pasted, without reaching for `weiter`.
  const handleChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH)
    setCode(digits)
    if (digits.length === OTP_LENGTH) verify(digits)
  }

  // Stays clickable after a successful send: a second mail is exactly what someone
  // whose first one never arrived wants, and the send rate limit — which comes back
  // as its own banner — is the thing that says when to stop, not this button.
  const handleResend = async () => {
    if (resending) return
    setResending(true)
    setWarning(null)
    const { error } = await resendSignupOtp(email)
    setResending(false)
    if (error) {
      setResent(false)
      const banner = authBannerMessage(error)
      if (banner) {
        setWarning(banner)
        return
      }
      alertError('Die Email konnte nicht gesendet werden.', error.message)
      return
    }
    setResent(true)
  }

  return (
    <StepFrame
      title='Verifizierung'
      button={{
        label: saving ? <Spinner /> : 'weiter',
        // Kept as the fallback for what the auto-submit cannot see: a retry after a
        // wrong code, or a browser that fills the field without firing onChange.
        onClick: () => verify(code),
        disabled: code.length !== OTP_LENGTH || saving,
      }}
    >
      <Input
        label='Code'
        value={code}
        onChange={handleChange}
        inputMode='numeric'
        autoComplete='one-time-code'
        maxLength={OTP_LENGTH}
        placeholder='••••••'
      />

      {warning && <WarningBanner message={warning} />}

      {resent && !warning && <span className='text-center text-text-3 text-text'>Wir haben dir einen neuen Code geschickt.</span>}

      <button
        type='button'
        onClick={handleResend}
        disabled={resending}
        className='px-1 text-text-3 text-text disabled:opacity-60'
      >
        {resending ? 'Wird gesendet …' : 'Code erneut schicken'}
      </button>
    </StepFrame>
  )
}
