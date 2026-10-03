'use client'

import { useState } from 'react'
import StepFrame from '../StepFrame'
import Input from '@/components/shared/Input'
import AddButton from '@/components/shared/AddButton'
import FeatureChip from './FeatureChip'
import { LIMITS, cleanQuestions, type PartyDraft } from '../draft'

// The Frage sub-step (mockups Create 10, 12, 14): the add row on top, one Frage row
// per block beneath it, gone at five. Blocks carry an id for React only; the draft
// gets the plain strings.
export default function QuestionsStep({
  draft,
  onSave,
  onBack,
}: {
  draft: PartyDraft
  onSave: (patch: Partial<PartyDraft>) => void
  onBack: () => void
}) {
  const [blocks, setBlocks] = useState(() => draft.questions.map((text) => ({ id: crypto.randomUUID(), text })))

  const add = () => setBlocks((current) => [...current, { id: crypto.randomUUID(), text: '' }])
  const edit = (id: string, text: string) =>
    setBlocks((current) => current.map((block) => (block.id === id ? { ...block, text } : block)))
  const save = () => onSave({ questions: cleanQuestions(blocks.map((block) => block.text)) })

  return (
    <StepFrame
      title={<FeatureChip feature='questions' />}
      onBack={onBack}
      button={{ label: 'Hinzufügen', onClick: save, disabled: blocks.length === 0 }}
    >
      {blocks.length < LIMITS.questions && <AddButton label='Frage hinzufügen' onClick={add} />}
      {blocks.map((block) => (
        <Input
          key={block.id}
          label='Frage'
          value={block.text}
          onChange={(text) => edit(block.id, text)}
          placeholder='Was bringst du mit?'
          maxLength={LIMITS.question}
        />
      ))}
    </StepFrame>
  )
}
