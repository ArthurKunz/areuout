'use client'

import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import IconButton from '@/components/shared/IconButton'

// The header of the pages inside the detail (App Redesign 3.6): back to the detail top
// left, the title centred and bold, an optional button top right. An empty slot of the
// same width keeps the title centred when there is none.
export default function PageHeader({ title, actions, onBack }: { title: string; actions?: ReactNode; onBack: () => void }) {
  return (
    <div className='relative z-10 flex shrink-0 items-center justify-between gap-3 px-5'>
      <IconButton icon={ChevronLeft} label='Zurück' onClick={onBack} />
      <h1 className='min-w-0 flex-1 truncate text-center text-heading-1 font-bold text-heading'>{title}</h1>
      <div className='flex w-[45px] shrink-0 justify-end'>{actions}</div>
    </div>
  )
}
