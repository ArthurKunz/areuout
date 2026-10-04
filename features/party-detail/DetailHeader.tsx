'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import IconButton from '@/components/shared/IconButton'

// The detail's header (App Redesign 3.5): the name large and bold, `von` and the host
// in grey, `(Privat)` in yellow for private parties only. Top right the viewer's
// buttons, then ✗. It stays put while the cards scroll under it.
export default function DetailHeader({
  title,
  hostName,
  isPublic,
  actions,
  onClose,
}: {
  title: string
  hostName: string
  isPublic: boolean
  actions?: ReactNode
  onClose: () => void
}) {
  return (
    <div className='relative z-10 flex shrink-0 items-start justify-between gap-3 px-5'>
      <div className='flex min-w-0 flex-col'>
        <h1 className='text-heading-1 font-bold break-words text-heading'>{title}</h1>
        <span className='text-text-3 text-text'>von {hostName}</span>
        {!isPublic && <span className='text-text-3 text-yellow'>(Privat)</span>}
      </div>
      <div className='flex shrink-0 items-center gap-2'>
        {actions}
        <IconButton icon={X} label='Schließen' onClick={onClose} />
      </div>
    </div>
  )
}
