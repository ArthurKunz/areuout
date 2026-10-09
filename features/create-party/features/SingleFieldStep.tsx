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

// Digits and at most one comma, 4 places before it and 2 after — the shape
// numeric(6,2) accepts. Clamps rather than swallows, like toGuests above.
const toPrice = (value: string) => {
  const [whole, ...rest] = value.replace(/[^\d,]/g, '').split(',')
  return whole.slice(0, 4) + (rest.length ? ',' + rest.join('').slice(0, 2) : '')
}

// '2,50' becomes 2.5. German comma in, dot out, because that is what numeric takes.
const priceNumber = (value: string) => Number(value.replace(',', '.'))

const FIELDS = {
  motto: { label: 'Motto', placeholder: 'z.B. Halloween', maxLength: LIMITS.motto },
  maxGuests: { label: 'Max. Teilnehmer', placeholder: 'z.B. 50', maxLength: undefined },
  dresscode: { label: 'Dresscode', placeholder: 'z.B. Verkleidung', maxLength: LIMITS.dresscode },
  price: { label: 'Preis', placeholder: 'z.B. 5€', maxLength: undefined },
} as const

// The Motto, max. Teilnehmer, Dresscode and Preis sub-steps: one row each (mockups
// Create 07–09 and 16). Works on a local copy; back discards it, Hinzufügen saves it.
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
  const [value, setValue] = useState(() =>
    field === 'price' && draft.price !== null ? String(draft.price).replace('.', ',') : String(draft[field] ?? '')
  )
  const { label, placeholder, maxLength } = FIELDS[field]
  const trimmed = value.trim()

  // A price of 0 is refused here and by events_price_check: "no price" is already said
  // by leaving the chip off, so 0 would be a second way of saying the same thing.
  const incomplete = !trimmed || (field === 'price' && !(priceNumber(trimmed) > 0))

  const save = () => {
    switch (field) {
      case 'maxGuests':
        return onSave({ maxGuests: Number(trimmed) })
      case 'price':
        return onSave({ price: priceNumber(trimmed) })
      case 'motto':
        return onSave({ motto: trimmed })
      case 'dresscode':
        return onSave({ dresscode: trimmed })
    }
  }

  return (
    <StepFrame
      title={<FeatureChip feature={field} />}
      onBack={onBack}
      button={{ label: 'Hinzufügen', onClick: save, disabled: incomplete }}
    >
      <Input
        label={label}
        value={value}
        onChange={(next) => setValue(field === 'maxGuests' ? toGuests(next) : field === 'price' ? toPrice(next) : next)}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={field === 'maxGuests' ? 'numeric' : field === 'price' ? 'decimal' : undefined}
      />
    </StepFrame>
  )
}
