'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import {
  addPoolResponse,
  removePoolResponse,
  upsertPoolResponse,
  type DetailPoll,
  type DetailResponse,
} from '@/features/parties/services/pools.service'
import { alertError } from '@/lib/utils'

// The options of a poll card (App Redesign 3.5, card 8): a round select button — round
// also when several answers are allowed, only the behaviour differs — and a blue bar for
// the option's share of all votes.
// A tap shows at once and is written behind it; a failed write puts the old votes back.
// Single choice: another option moves the vote, the own option again takes it back.
// Several answers: every tap toggles that option alone.
export default function PollOptions({
  poll,
  userId,
  disabled,
  onChange,
  onSaved,
}: {
  poll: DetailPoll
  userId: string | null
  // No RSVP: visible, not usable.
  disabled: boolean
  onChange: (poll: DetailPoll) => void
  // The write went through; the caller reads the votes again.
  onSaved: () => void
}) {
  const [writing, setWriting] = useState(false)
  const total = poll.responses.filter((response) => response.option_id).length
  const mine = poll.responses.filter((response) => response.user_id === userId && response.option_id)

  const vote = async (optionId: string) => {
    if (writing || disabled || !userId) return
    const had = mine.some((response) => response.option_id === optionId)
    // Name and picture come back with the re-read; until then the own entry carries
    // whatever the previous vote had.
    const me: DetailResponse = {
      option_id: optionId,
      user_id: userId,
      firstname: mine[0]?.firstname ?? null,
      lastname: mine[0]?.lastname ?? null,
      avatar_url: mine[0]?.avatar_url ?? null,
      avatar_color: mine[0]?.avatar_color ?? null,
      text_response: null,
    }
    const others = poll.responses.filter((response) => response.user_id !== userId)
    const next = had
      ? poll.responses.filter((response) => !(response.user_id === userId && response.option_id === optionId))
      : poll.allow_multiple
        ? [...poll.responses, me]
        : [...others, me]

    setWriting(true)
    onChange({ ...poll, responses: next })
    const { error } = had
      ? await removePoolResponse(poll.pool_id, userId, optionId)
      : poll.allow_multiple
        ? await addPoolResponse(poll.pool_id, userId, optionId)
        : await upsertPoolResponse(poll.pool_id, optionId, null)
    setWriting(false)
    if (error) {
      onChange(poll)
      alertError('Deine Stimme konnte nicht gespeichert werden.', error.message)
      return
    }
    onSaved()
  }

  return (
    <ul className={`mt-3 flex flex-col gap-3 ${disabled ? 'opacity-50' : ''}`}>
      {poll.options.map((option) => {
        const votes = poll.responses.filter((response) => response.option_id === option.option_id).length
        const selected = mine.some((response) => response.option_id === option.option_id)
        return (
          <li key={option.option_id}>
            <button
              type='button'
              onClick={() => vote(option.option_id)}
              disabled={disabled}
              aria-pressed={selected}
              className='flex w-full items-center gap-3 text-left'
            >
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full transition-colors duration-(--duration-press) ease-ios ${
                  selected ? 'bg-brand' : 'border border-main-white'
                }`}
              >
                {selected && <Check size={12} strokeWidth={3} className='icon-in text-main-white' />}
              </span>
              <span className='flex min-w-0 flex-1 flex-col gap-1.5'>
                <span className='break-words text-text-3 text-heading'>{option.label}</span>
                {/* The fill is always full width and slides in from the left, clipped by the
                    track: a transform, never width (step 11d). It moves only when a vote
                    changes it, not when the card appears. */}
                <span className='block h-1.5 w-full overflow-hidden rounded-full bg-progress-track'>
                  <span
                    className='block h-full w-full rounded-full bg-brand transition-transform duration-(--duration-move) ease-ios'
                    style={{ transform: `translateX(-${100 - (total ? (votes / total) * 100 : 0)}%)` }}
                  />
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
