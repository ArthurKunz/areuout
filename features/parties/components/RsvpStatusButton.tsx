'use client'

import { Check, X } from 'lucide-react'
import type { RsvpStatus } from '../types/parties.types'

const STATUS_CLASS: Record<RsvpStatus, string> = {
  going: 'bg-green',
  maybe: 'bg-yellow',
  not_going: 'bg-red',
}

// The 45x45 circle that shows and changes the viewer's RSVP status: green
// check (zugesagt), yellow question mark (vielleicht), red cross (abgesagt).
export default function RsvpStatusButton({
  status,
  onClick,
}: {
  status: RsvpStatus
  onClick?: () => void
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-label='RSVP-Status ändern'
      className={`flex h-[45px] w-[45px] shrink-0 items-center justify-center rounded-full text-main-white backdrop-blur-[100px] ${STATUS_CLASS[status]}`}
    >
      {status === 'going' && <Check size={30} strokeWidth={2.5} />}
      {status === 'maybe' && <span className='text-[30px] font-bold leading-none'>?</span>}
      {status === 'not_going' && <X size={30} strokeWidth={2.5} />}
    </button>
  )
}
