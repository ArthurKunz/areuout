'use client'

import StepFrame from '../StepFrame'
import Chip from '@/components/shared/Chip'
import { FEATURES, type Feature } from '../features/FeatureChip'
import type { PartyDraft } from '../draft'

const ADDED: Record<Feature, (d: PartyDraft) => boolean> = {
  motto: (d) => d.motto !== null,
  maxGuests: (d) => d.maxGuests !== null,
  dresscode: (d) => d.dresscode !== null,
  polls: (d) => d.polls.length > 0,
  questions: (d) => d.questions.length > 0,
  description: (d) => d.description !== null,
}

const CLEARED: Record<Feature, Partial<PartyDraft>> = {
  motto: { motto: null },
  maxGuests: { maxGuests: null },
  dresscode: { dresscode: null },
  polls: { polls: [] },
  questions: { questions: [] },
  description: { description: null },
}

// The optional features as chips (mockups Create 06). A plain chip opens its sub-step;
// an added one shows ✗, its label edits and the ✗ removes it. Step 5 of Create Party and
// the Edit Party form both show it.
export function FeatureChips({
  draft,
  update,
  onOpen,
}: {
  draft: PartyDraft
  update: (patch: Partial<PartyDraft>) => void
  onOpen: (feature: Feature) => void
}) {
  return (
    <div className='flex w-full max-w-[350px] flex-wrap justify-center gap-2.5'>
      {FEATURES.map(({ key, variant, label }) => (
        <Chip
          key={key}
          variant={variant}
          selected={ADDED[key](draft)}
          onClick={() => onOpen(key)}
          onRemove={() => update(CLEARED[key])}
        >
          {label}
        </Chip>
      ))}
    </div>
  )
}

// Step 5: the features, then Erstellen.
export default function FeaturesStep({
  draft,
  update,
  onOpen,
  onCreate,
  saving,
  onBack,
  onClose,
}: {
  draft: PartyDraft
  update: (patch: Partial<PartyDraft>) => void
  onOpen: (feature: Feature) => void
  onCreate: () => void
  saving: boolean
  onBack: () => void
  onClose: () => void
}) {
  return (
    <StepFrame
      title='Features'
      onClose={onClose}
      onBack={onBack}
      button={{ label: 'Erstellen', onClick: onCreate, disabled: saving }}
    >
      <FeatureChips draft={draft} update={update} onOpen={onOpen} />
    </StepFrame>
  )
}
