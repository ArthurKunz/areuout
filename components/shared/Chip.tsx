'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'

// Same colours as that category's icon badge elsewhere (MottoCard,
// MaxParticipantsCard, PollCard, DresscodeCard, QuestionCard,
// DescriptionCard).
const VARIANT_CLASS = {
  motto: 'bg-rust',
  maxParticipants: 'bg-cobalt',
  poll: 'bg-violet',
  dresscode: 'bg-pink',
  question: 'bg-yellow',
  description: 'bg-taupe',
  price: 'bg-slate',
} as const

// The 36px-tall pill used to pick which optional info a host adds to a
// party (Motto, max. Teilnehmer, Umfrage, Dresscode, Frage, Beschreibung,
// Preis).
// Once selected it gains a 20x20 remove circle: tapping the label opens the
// info again to edit it (App Redesign 7.3), tapping the circle removes it —
// two different actions, so two separate buttons.
export default function Chip({
  variant,
  children,
  selected = false,
  onClick,
  onRemove,
}: {
  variant: keyof typeof VARIANT_CLASS
  children: ReactNode
  selected?: boolean
  onClick?: () => void
  onRemove?: () => void
}) {
  if (selected) {
    return (
      <div
        className={`flex h-[36px] shrink-0 items-center gap-2 rounded-full py-0 pl-4 pr-1.5 text-text-2 font-semibold text-heading ${VARIANT_CLASS[variant]}`}
      >
        <button type='button' onClick={onClick}>
          {children}
        </button>
        <button
          type='button'
          onClick={onRemove}
          aria-label='Entfernen'
          className='flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full bg-button-toggle-off'
        >
          <X size={13} className='text-main-white' />
        </button>
      </div>
    )
  }
  return (
    <button
      type='button'
      onClick={onClick}
      className={`flex h-[36px] shrink-0 items-center rounded-full px-4 text-text-2 font-semibold text-heading ${VARIANT_CLASS[variant]}`}
    >
      {children}
    </button>
  )
}
