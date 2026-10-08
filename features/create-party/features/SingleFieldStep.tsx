'use client'

import { useState } from 'react'
import StepFrame from '../StepFrame'
import Input from '@/components/shared/Input'
import FeatureChip from './FeatureChip'
import { LIMITS, type PartyDraft } from '../draft'

// Typing past the cap clamps to it rather than being swallowed, as in the old flow, so
// the number on screen is always the one that will be saved.
const toGuests = (value: string) => {
  const digits = value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 4)
  return Number(digits) > LIMITS.maxGuests ? String(LIMITS.maxGuests) : digits
}

const FIELDS = {
  motto: { label: 'Motto', placeholder: 'z.B. Halloween', maxLength: LIMITS.motto },
  maxGuests: { label: 'Max. Teilnehmer', placeholder: 'z.B. 50', maxLength: undefined },
  dresscode: { label: 'Dresscode', placeholder: 'z.B. Verkleidung', maxLength: LIMITS.dresscode },
} as const

// The Motto, max. Teilnehmer and Dresscode sub-steps: one row each (mockups Create
// 07–09). Works on a local copy; back discards it, Hinzufügen saves it.
export default function SingleFieldStep({
  field,
  draft,
  onSave,
  onBack,
}: {
  field: keyof typeof FIELDS
  draft: PartyDraft
  onSave: (patch: Partial<PartyDraft>) => void
  onBack: () => void
}) {
  const [value, setValue] = useState(() => String(draft[field] ?? ''))
  const { label, placeholder, maxLength } = FIELDS[field]
  const numeric = field === 'maxGuests'
  const trimmed = value.trim()

  const save = () =>
    onSave(
      field === 'maxGuests' ? { maxGuests: Number(trimmed) } : field === 'motto' ? { motto: trimmed } : { dresscode: trimmed },
    )

  return (
    <StepFrame
      title={<FeatureChip feature={field} />}
      onBack={onBack}
      button={{ label: 'Hinzufügen', onClick: save, disabled: !trimmed }}
    >
      <Input
        label={label}
        value={value}
        onChange={(next) => setValue(numeric ? toGuests(next) : next)}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={numeric ? 'numeric' : undefined}
      />
    </StepFrame>
  )
}
