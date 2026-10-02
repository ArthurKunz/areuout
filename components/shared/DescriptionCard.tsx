'use client'

import { Info } from 'lucide-react'

// The description tile on the event detail page: taupe info badge top left,
// label, then a multi-line text below. Same bg-main + 100px blur as the
// other info cards; height grows with the text instead of being fixed.
export default function DescriptionCard({ text }: { text: string }) {
  return (
    <div className='flex w-[350px] flex-col rounded-[25px] bg-main p-4 backdrop-blur-[100px]'>
      <span className='flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-taupe'>
        <Info size={18} className='text-main-white' />
      </span>
      <div className='mt-2 flex flex-col'>
        <span className='text-text-2 font-bold text-heading'>Beschreibung</span>
        <span className='text-text-3 text-text'>{text}</span>
      </div>
    </div>
  )
}
