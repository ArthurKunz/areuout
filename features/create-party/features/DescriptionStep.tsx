'use client'

import { useState } from 'react'
import StepFrame from '../StepFrame'
import FeatureChip from './FeatureChip'
import { LIMITS, type PartyDraft } from '../draft'

// The Beschreibung sub-step. No mockup: a card shaped like InputGroup holding a
// textarea, with its count beneath. Works on a local copy; back discards it.
export default function DescriptionStep({
  draft,
  onSave,
  onBack,
}: {
  draft: PartyDraft
  onSave: (patch: Partial<PartyDraft>) => void
  onBack: () => void
}) {
  const [value, setValue] = useState(draft.description ?? '')
  const trimmed = value.trim()

  return (
    <StepFrame
      title={<FeatureChip feature='description' />}
      onBack={onBack}
      button={{ label: 'Hinzufügen', onClick: () => onSave({ description: trimmed }), disabled: !trimmed }}
    >
      <div className='flex w-full max-w-[350px] flex-col gap-1.5'>
        <div className='rounded-[25px] bg-main glass-control'>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder='Details'
            rows={6}
            maxLength={LIMITS.description}
            className='block w-full resize-none bg-transparent px-4 py-3.5 text-text-3 text-text outline-none placeholder:text-input'
          />
        </div>
        <p className='px-4 text-right text-text-4 text-text'>
          {value.length}/{LIMITS.description}
        </p>
      </div>
    </StepFrame>
  )
}
