'use client'

import { Lightbulb } from 'lucide-react'

// The 167x108 motto tile on the event detail page: rust lightbulb badge top
// left, label and value anchored to the bottom. Same bg-main + 100px blur
// as AddButton/Input.
export default function MottoCard({ value }: { value: string }) {
  return (
    <div className='flex h-[108px] w-[167px] flex-col rounded-[25px] bg-main p-4 backdrop-blur-[100px]'>
      <span className='flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-rust'>
        <Lightbulb size={18} className='text-main-white' />
      </span>
      <div className='mt-2 flex flex-col'>
        <span className='text-text-2 font-semibold text-heading'>Motto</span>
        <span className='text-text-3 text-text'>{value}</span>
      </div>
    </div>
  )
}
