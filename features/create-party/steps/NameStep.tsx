'use client'

import StepFrame from '../StepFrame'
import ToggleInput from '@/components/shared/ToggleInput'
import Input from '@/components/shared/Input'
import { LIMITS, canLeaveName, type PartyDraft } from '../draft'

// Step 1: who can find the party, and what it is called. Öffentlich off means privat,
// the default. The first step has no back.
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
      <ToggleInput label='Öffentlich' checked={draft.isPublic} onChange={(isPublic) => update({ isPublic })} />
      <Input
        label='Name'
        value={draft.title}
        onChange={(title) => update({ title })}
        placeholder='z.B. Hausparty'
        maxLength={LIMITS.title}
      />
    </StepFrame>
  )
}
