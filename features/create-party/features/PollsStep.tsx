'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import StepFrame from '../StepFrame'
import AddButton from '@/components/shared/AddButton'
import ToggleInput from '@/components/shared/ToggleInput'
import SwipeToRemove from '@/components/shared/SwipeToRemove'
import { InputRow } from '@/components/shared/Input'
import FeatureChip from './FeatureChip'
import { PreviewRow, previewDivider, previewSurface } from './Preview'
import { LIMITS, cleanPolls, newBlockKey, pollsValid, type PollDraft, type PartyDraft } from '../draft'

const OPTION_PLACEHOLDERS = ['z.B. Ja', 'z.B. Nein']

type Listed = PollDraft & { key: number }

// The Umfrage sub-step, two screens in one (mockups Create 11, 13, 15):
// - the list: the add row (gone at five) and a preview card per poll. A tap on a
//   preview edits it, a swipe to the left removes it. Hinzufügen writes the list to the
//   draft; back leaves without saving.
// - the form: one poll, Frage and its options, the add-option row (gone at ten) and the
//   mehrere-Antworten toggle. Hinzufügen puts it into the list; back discards it.
// Polls in the list are always cleaned and valid, so the list never needs checking.
export default function PollsStep({
  draft,
  onSave,
  onBack,
}: {
  draft: PartyDraft
  onSave: (patch: Partial<PartyDraft>) => void
  onBack: () => void
}) {
  const [polls, setPolls] = useState<Listed[]>(() => draft.polls.map((poll) => ({ ...poll, key: newBlockKey() })))
  // The poll on the form screen; key null for a new one. null: the list is shown.
  const [form, setForm] = useState<{ key: number | null; poll: PollDraft } | null>(null)

  if (form) {
    const { poll } = form
    const edit = (patch: Partial<PollDraft>) => setForm({ ...form, poll: { ...poll, ...patch } })
    const cleaned = cleanPolls([poll])
    // A poll needs a question and at least two filled options; an untouched form is
    // not a poll either.
    const valid = cleaned.length === 1 && pollsValid(cleaned)
    const add = () => {
      const saved = { ...cleaned[0], key: form.key ?? newBlockKey() }
      setPolls((current) =>
        form.key === null ? [...current, saved] : current.map((p) => (p.key === form.key ? saved : p))
      )
      setForm(null)
    }

    return (
      <StepFrame
        title={<FeatureChip feature='polls' />}
        onBack={() => setForm(null)}
        button={{ label: 'Hinzufügen', onClick: add, disabled: !valid }}
      >
        <div className={previewSurface}>
          <InputRow
            label='Frage'
            value={poll.question}
            onChange={(question) => edit({ question })}
            placeholder='z. B. Bringst du was mit?'
            maxLength={LIMITS.pollQuestion}
          />
          {poll.options.map((option, i) => (
            // Options are only ever appended, so the index is a stable key.
            <div key={i}>
              {previewDivider}
              <InputRow
                label={`Option ${i + 1}`}
                value={option}
                onChange={(next) => edit({ options: poll.options.map((o, j) => (j === i ? next : o)) })}
                placeholder={OPTION_PLACEHOLDERS[i]}
                maxLength={LIMITS.option}
              />
            </div>
          ))}
          {poll.options.length < LIMITS.maxOptions && (
            <>
              {previewDivider}
              <button
                type='button'
                onClick={() => edit({ options: [...poll.options, ''] })}
                className='flex h-[50px] w-full items-center gap-3 px-4'
              >
                <span className='flex h-[25px] w-[25px] shrink-0 items-center justify-center rounded-full bg-green'>
                  <Plus size={20} className='text-main-white' />
                </span>
                <span className='text-text-3 font-semibold text-heading'>Option hinzufügen</span>
              </button>
            </>
          )}
        </div>
        <ToggleInput
          label='mehrere Antworten erlauben'
          checked={poll.allowMultiple}
          onChange={(allowMultiple) => edit({ allowMultiple })}
        />
      </StepFrame>
    )
  }

  const plain = polls.map(({ question, options, allowMultiple }) => ({ question, options, allowMultiple }))

  return (
    <StepFrame
      title={<FeatureChip feature='polls' />}
      onBack={onBack}
      button={{ label: 'Hinzufügen', onClick: () => onSave({ polls: plain }) }}
    >
      {polls.length < LIMITS.polls && (
        <AddButton
          label='Umfrage hinzufügen'
          onClick={() => setForm({ key: null, poll: { question: '', options: ['', ''], allowMultiple: false } })}
        />
      )}
      {polls.map(({ key, ...poll }) => (
        <SwipeToRemove
          key={key}
          onTap={() => setForm({ key, poll })}
          onRemove={() => setPolls((current) => current.filter((p) => p.key !== key))}
        >
          <div className={previewSurface}>
            <PreviewRow label='Frage' value={poll.question} />
            {poll.options.map((option, i) => (
              <div key={i}>
                {previewDivider}
                <PreviewRow label={`Option ${i + 1}`} value={option} />
              </div>
            ))}
          </div>
        </SwipeToRemove>
      ))}
    </StepFrame>
  )
}
