'use client'

import { useState } from 'react'
import StepFrame from '../StepFrame'
import Input from '@/components/shared/Input'
import AddButton from '@/components/shared/AddButton'
import SwipeToRemove from '@/components/shared/SwipeToRemove'
import FeatureChip from './FeatureChip'
import { PreviewRow, previewSurface } from './Preview'
import { LIMITS, newBlockKey, type PartyDraft } from '../draft'

type Listed = { key: number; text: string }

// The Frage sub-step, two screens in one (mockups Create 10, 12, 14), built like
// PollsStep:
// - the list: the add row (gone at five) and a preview row per question. A tap edits
//   it, a swipe to the left removes it. Hinzufügen writes the list to the draft; back
//   leaves without saving.
// - the form: one Frage row. Hinzufügen puts it into the list; back discards it.
export default function QuestionsStep({
  draft,
  onSave,
  onBack,
}: {
  draft: PartyDraft
  onSave: (patch: Partial<PartyDraft>) => void
  onBack: () => void
}) {
  const [questions, setQuestions] = useState<Listed[]>(() => draft.questions.map((text) => ({ key: newBlockKey(), text })))
  // The question on the form screen; key null for a new one. null: the list is shown.
  const [form, setForm] = useState<Listed | { key: null; text: string } | null>(null)

  if (form) {
    const text = form.text.trim()
    const add = () => {
      const saved = { key: form.key ?? newBlockKey(), text }
      setQuestions((current) =>
        form.key === null ? [...current, saved] : current.map((q) => (q.key === form.key ? saved : q))
      )
      setForm(null)
    }

    return (
      <StepFrame
        title={<FeatureChip feature='questions' />}
        onBack={() => setForm(null)}
        button={{ label: 'Hinzufügen', onClick: add, disabled: !text }}
      >
        <Input
          label='Frage'
          value={form.text}
          onChange={(next) => setForm({ ...form, text: next })}
          placeholder='z.B. Was bringst du mit?'
          maxLength={LIMITS.question}
        />
      </StepFrame>
    )
  }

  return (
    <StepFrame
      title={<FeatureChip feature='questions' />}
      onBack={onBack}
      button={{ label: 'Hinzufügen', onClick: () => onSave({ questions: questions.map((q) => q.text) }) }}
    >
      {questions.length < LIMITS.questions && (
        <AddButton label='Frage hinzufügen' onClick={() => setForm({ key: null, text: '' })} />
      )}
      {questions.map((question) => (
        <SwipeToRemove
          key={question.key}
          onTap={() => setForm(question)}
          onRemove={() => setQuestions((current) => current.filter((q) => q.key !== question.key))}
        >
          <div className={previewSurface}>
            <PreviewRow label='Frage' value={question.text} />
          </div>
        </SwipeToRemove>
      ))}
    </StepFrame>
  )
}
