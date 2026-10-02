'use client'

import { Clock } from 'lucide-react'

// The 167x108 time tile on the event detail page: green clock badge top
// left, label and value anchored to the bottom. Same bg-main + 100px blur
// as AddButton/Input.
export default function TimeCard({ value }: { value: string }) {
  return (
    <div className='flex h-[108px] w-[167px] flex-col rounded-[25px] bg-main p-4 backdrop-blur-[100px]'>
      <span className='flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-green'>
        <Clock size={18} className='text-main-white' />
      </span>
      <div className='mt-2 flex flex-col'>
        <span className='text-text-2 font-bold text-heading'>Uhrzeit</span>
        <span className='text-text-3 text-text'>{value}</span>
      </div>
    </div>
  )
}
