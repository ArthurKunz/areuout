'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import StepFrame from '@/features/create-party/StepFrame'
import InputGroup from '@/components/shared/InputGroup'
import Spinner from '@/components/shared/Spinner'
import WarningBanner from '@/components/shared/WarningBanner'
import { alertError } from '@/lib/utils'
import { usePasswordValidation } from '@/features/auth/hooks/usePasswordValidation'
import { authBannerMessage } from '@/features/auth/services/auth-errors'

interface ChangePasswordFormProps {
  onSuccess?: () => void
}

// The last step of the reset flow, reached from the link in the email. No mockup: the
// same frame as every other auth step, and the same two rows and live warnings as the
// profile's Password page.
export default function ChangePasswordForm({ onSuccess }: ChangePasswordFormProps) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [serverWarning, setServerWarning] = useState<string | null>(null)
  const { passwordWarning, isPasswordValid } = usePasswordValidation(password)

  // Both warnings are live rather than waiting for the save: a mismatch beats a
  // weak-password hint, since it is the one that blocks the button.
  const mismatch = confirm.length > 0 && password !== confirm
  const warning = serverWarning
    ?? (mismatch
      ? 'Passwörter stimmen nicht überein'
      : password.length > 0 && passwordWarning
        ? passwordWarning
        : null)
  const canSave = password.length > 0 && confirm.length > 0 && !mismatch && isPasswordValid

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    setServerWarning(null)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) {
      const banner = authBannerMessage(error)
      if (banner) {
        setServerWarning(banner)
        return
      }
      // Not fixable here — a dead recovery link needs a fresh one from the login screen.
      alertError('Dein Passwort konnte nicht geändert werden.', error.message)
      return
    }
    if (onSuccess) onSuccess()
    else router.push('/explore')
  }

  return (
    <StepFrame
      title='Passwort'
      onBack={() => router.push('/login')}
      button={{ label: saving ? <Spinner /> : 'speichern', onClick: handleSave, disabled: !canSave || saving }}
    >
      <InputGroup
        rows={[
          {
            label: 'neues Passwort',
            value: password,
            onChange: (value) => {
              setPassword(value)
              setServerWarning(null)
            },
            type: 'password',
            autoComplete: 'new-password',
            placeholder: '••••••••',
          },
          {
            label: 'Passwort wiederholen',
            value: confirm,
            onChange: setConfirm,
            type: 'password',
            autoComplete: 'new-password',
            placeholder: '••••••••',
            onEnter: handleSave,
          },
        ]}
      />

      {warning && <WarningBanner message={warning} />}
    </StepFrame>
  )
}
