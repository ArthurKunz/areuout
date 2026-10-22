'use client'

import { useEffect, useState } from 'react'
import StepFrame from '@/features/create-party/StepFrame'
import InputGroup from '@/components/shared/InputGroup'
import { Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/shared/Alert'
import { NAME_MAX } from '../constants/onboarding.constants'
import { getSession } from '../services/onboarding.service'
import type { NameFormProps } from '../types/onboarding.types'

export default function PersonalDataForm({ onSuccess }: NameFormProps) {
  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')

  // Sign in with Apple leaves the name Apple sent in the auth metadata
  // (auth.service.ts). It is only a suggestion: a field the user has typed in stays.
  useEffect(() => {
    getSession().then(({ data: { session } }) => {
      const meta = session?.user.user_metadata
      if (typeof meta?.given_name === 'string') setFirstname((current) => current || meta.given_name.slice(0, NAME_MAX))
      if (typeof meta?.family_name === 'string') setLastname((current) => current || meta.family_name.slice(0, NAME_MAX))
    })
  }, [])

  const canContinue = firstname.trim().length > 0 && lastname.trim().length > 0
  const atLimit = firstname.length >= NAME_MAX || lastname.length >= NAME_MAX
  const submit = () => canContinue && onSuccess(firstname, lastname)

  // No back and no ✗: there is nothing behind this step. The browser's own back button
  // already bounces off the proxy gate and returns here, and a back button that quietly
  // signed the user out instead was the one control in the flow that did something
  // other than what it looked like.
  return (
    <StepFrame title='Name' button={{ label: 'weiter', onClick: submit, disabled: !canContinue }}>
      <InputGroup
        rows={[
          {
            label: 'Vorname',
            value: firstname,
            onChange: setFirstname,
            autoComplete: 'given-name',
            placeholder: 'z.B. Max',
            maxLength: NAME_MAX,
          },
          {
            label: 'Nachname',
            value: lastname,
            onChange: setLastname,
            autoComplete: 'family-name',
            placeholder: 'z.B. Mustermann',
            maxLength: NAME_MAX,
            onEnter: submit,
          },
        ]}
      />

      {atLimit && (
        <Alert tone='notice'>
          <Info />
          <AlertDescription>{`Maximal ${NAME_MAX} Zeichen`}</AlertDescription>
        </Alert>
      )}
    </StepFrame>
  )
}
