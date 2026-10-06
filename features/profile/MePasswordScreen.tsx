'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { FitSheet } from '@/components/shell/Shell'
import StepFrame from '@/features/create-party/StepFrame'
import InputGroup from '@/components/shared/InputGroup'
import WarningBanner from '@/components/shared/WarningBanner'
import { alertError } from '@/lib/utils'
import { usePasswordValidation } from '@/features/auth/hooks/usePasswordValidation'

// Page `Password` (App Redesign 8). Same checks as sign-up, typed twice, as before.
export default function MePasswordScreen() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const { passwordWarning, isPasswordValid } = usePasswordValidation(password)

  // A mismatch beats a weak-password hint: it is the one that blocks the button.
  const mismatch = confirm.length > 0 && password !== confirm
  const warning = mismatch
    ? 'Passwörter stimmen nicht überein'
    : password.length > 0 && passwordWarning
      ? passwordWarning
      : null
  const canSave = password.length > 0 && confirm.length > 0 && !mismatch

  const handleSave = async () => {
    if (!isPasswordValid) {
      alertError(passwordWarning || 'Dieses Passwort ist zu schwach.')
      return
    }
    if (password !== confirm) {
      alertError('Die beiden Passwörter stimmen nicht überein.')
      return
    }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) {
      alertError('Dein Passwort konnte nicht geändert werden.', error.message)
      return
    }
    router.push('/me')
  }

  return (
    <>
      <FitSheet />
      <StepFrame
        title='Password'
        onBack={() => router.push('/me')}
        button={{
          label: 'Hinzufügen',
          onClick: handleSave,
          disabled: !canSave || saving,
        }}
      >
        <InputGroup
          rows={[
            { label: 'Password eingeben', value: password, onChange: setPassword, type: 'password', placeholder: '••••••••' },
            { label: 'Password wiederholen', value: confirm, onChange: setConfirm, type: 'password', placeholder: '••••••••' },
          ]}
        />
        {warning && <WarningBanner message={warning} />}
      </StepFrame>
    </>
  )
}
