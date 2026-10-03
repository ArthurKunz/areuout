'use client'

import StepFrame from '../StepFrame'
import SegmentedControl from '@/components/shared/SegmentedControl'
import Input from '@/components/shared/Input'
import { LIMITS, canLeaveName, type PartyDraft } from '../draft'

const VISIBILITY = [
  { value: 'public', label: 'öffentlich' },
  { value: 'private', label: 'privat' },
] as const

// Step 1: who can find the party, and what it is called. The first step has no back.
export default function NameStep({
  draft,
  update,
  onNext,
  onClose,
}: {
  draft: PartyDraft
  update: (patch: Partial<PartyDraft>) => void
  onNext: () => void
  onClose: () => void
}) {
  return (
    <StepFrame
      title='Party erstellen'
      onClose={onClose}
      button={{ label: 'Weiter', onClick: onNext, disabled: !canLeaveName(draft) }}
    >
      <SegmentedControl
        options={[...VISIBILITY]}
        value={draft.isPublic ? 'public' : 'private'}
        onChange={(value) => update({ isPublic: value === 'public' })}
      />
      <Input
        label='Name'
        value={draft.title}
        onChange={(title) => update({ title })}
        placeholder='Hausparty'
        maxLength={LIMITS.title}
      />
    </StepFrame>
  )
}
