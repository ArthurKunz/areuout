'use client'

import { ChevronRight, Footprints } from 'lucide-react'

// The 350x160 location tile on the event detail page: sky-blue footprints
// badge top left, label and value below, then a divider and a "Route
// anzeigen" row in the brand colour. Same bg-main + 100px blur as the other
// info cards.
export default function LocationCard({
  address,
  onRouteClick,
}: {
  address: string
  onRouteClick?: () => void
}) {
  return (
    <div className='flex h-[160px] w-[350px] flex-col rounded-[25px] bg-main p-4 backdrop-blur-[100px]'>
      <span className='flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-sky'>
        <Footprints size={18} className='text-main-white' />
      </span>
      <div className='mt-2 flex flex-col'>
        <span className='text-text-2 font-semibold text-heading'>Location</span>
        <span className='text-text-3 text-text'>{address}</span>
      </div>
      <div className='mt-auto flex flex-col gap-3'>
        <div className='h-px w-full bg-divider' />
        <button
          type='button'
          onClick={onRouteClick}
          className='flex items-center justify-between text-text-2 font-medium text-brand'
        >
          <span>Route anzeigen</span>
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  )
}
