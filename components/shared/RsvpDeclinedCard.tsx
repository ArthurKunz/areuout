'use client'

import { X } from 'lucide-react'

// The 167x108 "Abgesagt" stat tile on the guest list page: red cross badge
// top left, label and value anchored to the bottom. Same bg-main + 100px
// blur as DateCard/MottoCard.
export default function RsvpDeclinedCard({ value }: { value: number }) {
  return (
    <div className='flex h-[108px] w-[167px] flex-col rounded-[25px] bg-main p-4 backdrop-blur-[100px]'>
      <span className='flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-red'>
        <X size={18} className='text-main-white' />
      </span>
      <div className='mt-2 flex flex-col'>
        <span className='text-text-2 font-bold text-heading'>Abgesagt</span>
        <span className='text-text-3 text-text'>{value}</span>
      </div>
    </div>
  )
}
