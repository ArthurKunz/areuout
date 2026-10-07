'use client'

import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import IconButton from '@/components/shared/IconButton'

// The header of the pages inside the detail (App Redesign 3.6) at the top of their
// scrolling content: back to the detail top left, the title centred and bold, an
// optional button top right. An empty slot of the same width keeps the title centred
// when there is none. It scrolls away with the content and nothing takes its place,
// like the detail's (step 11b).
export default function PageHeader({
  title,
  actions,
  onBack,
  children,
}: {
  title: string
  actions?: ReactNode
  onBack: () => void
  children: ReactNode
}) {
  return (
    // Up to the container's top edge: content scrolls on under the rounded corners
    // instead of being cut 24px below them.
    <div className='-mt-6 min-h-0 flex-1 overflow-y-auto px-5 pt-6 pb-5'>
      <div className='flex items-center justify-between gap-3'>
        <IconButton icon={ChevronLeft} label='Zurück' onClick={onBack} />
        <h1 className='min-w-0 flex-1 truncate text-center text-heading-1 font-bold text-heading'>{title}</h1>
        <div className='flex w-[45px] shrink-0 justify-end'>{actions}</div>
      </div>
      <div className='pt-4'>{children}</div>
    </div>
  )
}
