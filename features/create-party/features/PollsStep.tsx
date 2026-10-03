'use client'

import { Fragment, useState } from 'react'
import { Plus } from 'lucide-react'
import StepFrame from '../StepFrame'
import AddButton from '@/components/shared/AddButton'
import ToggleInput from '@/components/shared/ToggleInput'
import { InputRow } from '@/components/shared/Input'
import FeatureChip from './FeatureChip'
import { LIMITS, cleanPolls, pollsValid, type PollDraft, type PartyDraft } from '../draft'

const OPTION_PLACEHOLDERS = ['z.B. Ja', 'z.B. Nein']

const divider = <div className='mx-4 h-px rounded-full bg-divider' />

// The Umfrage sub-step (mockups Create 11, 13, 15): the add row on top, gone at five,
// then per poll a card of Frage and options with its own add-option row, and the
// mehrere-Antworten toggle beneath it. Polls carry an id for React only; the draft
// gets them without.
export default function PollsStep({
  draft,
  onSave,
  onBack,
}: {
  draft: PartyDraft
  onSave: (patch: Partial<PartyDraft>) => void
  onBack: () => void
}) {
  const [polls, setPolls] = useState(() => draft.polls.map((poll) => ({ ...poll, id: crypto.randomUUID() })))

  const add = () =>
    setPolls((current) => [...current, { id: crypto.randomUUID(), question: '', options: ['', ''], allowMultiple: false }])
  const edit = (id: string, patch: Partial<PollDraft>) =>
    setPolls((current) => current.map((poll) => (poll.id === id ? { ...poll, ...patch } : poll)))

  // Strips the ids before cleaning, since the draft's polls have none.
  const plain = polls.map(({ question, options, allowMultiple }) => ({ question, options, allowMultiple }))
  const save = () => onSave({ polls: cleanPolls(plain) })

  return (
    <StepFrame
      title={<FeatureChip feature='polls' />}
      onBack={onBack}
      button={{ label: 'Hinzufügen', onClick: save, disabled: polls.length === 0 || !pollsValid(plain) }}
    >
      {polls.length < LIMITS.polls && <AddButton label='Umfrage hinzufügen' onClick={add} />}
      {polls.map((poll) => (
        <Fragment key={poll.id}>
          <div className='w-[350px] rounded-[25px] bg-main backdrop-blur-[100px]'>
            <InputRow
              label='Frage'
              value={poll.question}
              onChange={(question) => edit(poll.id, { question })}
              placeholder='z. B. Bringst du was mit?'
              maxLength={LIMITS.pollQuestion}
            />
            {poll.options.map((option, i) => (
              // Options are only ever appended, so the index is a stable key.
              <div key={i}>
                {divider}
                <InputRow
                  label={`Option ${i + 1}`}
                  value={option}
                  onChange={(next) => edit(poll.id, { options: poll.options.map((o, j) => (j === i ? next : o)) })}
                  placeholder={OPTION_PLACEHOLDERS[i]}
                  maxLength={LIMITS.option}
                />
              </div>
            ))}
            {poll.options.length < LIMITS.maxOptions && (
              <>
                {divider}
                <button
                  type='button'
                  onClick={() => edit(poll.id, { options: [...poll.options, ''] })}
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
            onChange={(allowMultiple) => edit(poll.id, { allowMultiple })}
          />
        </Fragment>
      ))}
    </StepFrame>
  )
}
