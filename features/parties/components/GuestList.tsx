'use client'

import { Check, X } from 'lucide-react'
import type { RsvpStatus } from '../types/parties.types'

// A single 50px guest row: avatar, name, RSVP status glyph on the right.
// Swipe-to-remove (for the host) is not wired up yet — this only covers
// the row's rest state.
export function GuestListRow({
  avatarUrl,
  name,
  status,
}: {
  avatarUrl: string
  name: string
  status: RsvpStatus
}) {
  return (
    <div className='flex h-[50px] items-center gap-3 px-4'>
      <img src={avatarUrl} alt='' className='h-[30px] w-[30px] shrink-0 rounded-full object-cover' />
      <span className='min-w-0 flex-1 truncate text-text-3 font-bold text-heading'>{name}</span>
      {status === 'going' && <Check size={20} className='shrink-0 text-heading' />}
      {status === 'maybe' && <span className='shrink-0 text-[20px] font-bold leading-none text-heading'>?</span>}
      {status === 'not_going' && <X size={20} className='shrink-0 text-heading' />}
    </div>
  )
}

// The 350px-wide container stacking one GuestListRow per guest, separated
// by hairline dividers — same pattern as InputGroup.
export default function GuestList({
  guests,
}: {
  guests: { id: string; avatarUrl: string; name: string; status: RsvpStatus }[]
}) {
  return (
    <div className='w-[350px] rounded-[25px] bg-main backdrop-blur-[100px]'>
      {guests.map((guest, i) => (
        <div key={guest.id}>
          {i > 0 && <div className='mx-4 h-px rounded-full bg-divider' />}
          <GuestListRow avatarUrl={guest.avatarUrl} name={guest.name} status={guest.status} />
        </div>
      ))}
    </div>
  )
}
