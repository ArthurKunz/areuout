'use client'

import { ChevronRight, Users } from 'lucide-react'

// The 350x160 participants tile on the event detail page: cobalt-blue users
// badge top left, label and value below, then a divider and a "Gästeliste
// anzeigen" row in the brand colour. Same bg-main + 100px blur as the other
// info cards.
export default function ParticipantsCard({
  count,
  onGuestListClick,
}: {
  count: number
  onGuestListClick?: () => void
}) {
  return (
    <div className='flex h-[160px] w-[350px] flex-col rounded-[25px] bg-main p-4 backdrop-blur-[100px]'>
      <span className='flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-cobalt'>
        <Users size={18} className='text-main-white' />
      </span>
      <div className='mt-2 flex flex-col'>
        <span className='text-text-2 font-semibold text-heading'>Teilnehmer</span>
        <span className='text-text-3 text-text'>{count} Teilnehmer</span>
      </div>
      <div className='mt-auto flex flex-col gap-3'>
        <div className='h-px w-full bg-divider' />
        <button
          type='button'
          onClick={onGuestListClick}
          className='flex items-center justify-between text-text-2 font-medium text-brand'
        >
          <span>Gästeliste anzeigen</span>
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  )
}
