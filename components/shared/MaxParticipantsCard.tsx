'use client'

import { Users } from 'lucide-react'

// The 167x108 "Max. Teilnehmer" stat tile on the guest list page: cobalt
// users badge top left, label and value anchored to the bottom. Same
// bg-main + 100px blur as DateCard/MottoCard.
export default function MaxParticipantsCard({ value }: { value: number }) {
  return (
    <div className='flex h-[108px] w-[167px] flex-col rounded-[25px] bg-main p-4 backdrop-blur-[100px]'>
      <span className='flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-cobalt'>
        <Users size={18} className='text-main-white' />
      </span>
      <div className='mt-2 flex flex-col'>
        <span className='text-text-2 font-semibold text-heading'>Max. Teilnehmer</span>
        <span className='text-text-3 text-text'>max. {value}</span>
      </div>
    </div>
  )
}
