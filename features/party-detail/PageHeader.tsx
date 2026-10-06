'use client'

import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import IconButton from '@/components/shared/IconButton'
import Headroom from './Headroom'

// The header of the pages inside the detail (App Redesign 3.6) around their scrolling
// content: back to the detail top left, the title centred and bold, an optional button
// top right. An empty slot of the same width keeps the title centred when there is
// none. It leaves on the way down and comes back on the way up, like the detail's.
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
    <Headroom
      bar={
        <div className='flex items-center justify-between gap-3'>
          <div className='pointer-events-auto'>
            <IconButton icon={ChevronLeft} label='Zurück' onClick={onBack} />
          </div>
          <h1 className='min-w-0 flex-1 truncate text-center text-heading-1 font-bold text-heading'>{title}</h1>
          <div className='pointer-events-auto flex w-[45px] shrink-0 justify-end'>{actions}</div>
        </div>
      }
    >
      {/* The bar's row, kept free above the content. */}
      <div className='pt-15.25'>{children}</div>
    </Headroom>
  )
}
