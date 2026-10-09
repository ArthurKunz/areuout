'use client'

import { Check } from 'lucide-react'
import type { RsvpStatus } from '../types/parties.types'

const OPTIONS: { status: RsvpStatus; label: string }[] = [
  { status: 'going', label: 'zugesagt' },
  { status: 'maybe', label: 'vielleicht' },
  { status: 'not_going', label: 'abgesagt' },
]

// The dropdown opened by RsvpStatusButton: one row per status, a check next
// to the current one, divided the same way as InputGroup. Every row keeps the check's
// column, as in an iOS menu, so a new choice moves the tick and never the labels.
export default function RsvpStatusMenu({
  status,
  onSelect,
}: {
  status: RsvpStatus
  onSelect: (next: RsvpStatus) => void
}) {
  return (
    <div className='flex h-[115px] w-[130px] flex-col rounded-[25px] bg-main glass-overlay'>
      {OPTIONS.map((option, i) => (
        <div key={option.status} className='flex flex-1 flex-col'>
          {i > 0 && <div className='mx-3 h-px rounded-full bg-divider' />}
          <button
            type='button'
            onClick={() => onSelect(option.status)}
            className='flex flex-1 items-center gap-2 px-3 text-left text-text-3 font-medium text-heading'
          >
            <span className='flex size-5 shrink-0 items-center'>
              {status === option.status && <Check size={20} className='icon-in' />}
            </span>
            <span>{option.label}</span>
          </button>
        </div>
      ))}
    </div>
  )
}
