'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import IconButton from '@/components/shared/IconButton'
import Headroom from './Headroom'

// The detail's header (App Redesign 3.5) around its scrolling cards: the name large and
// bold, `von` and the host in grey, `(Privat)` in yellow for private parties only. Top
// right the viewer's buttons, then ✗. The header scrolls away with the cards; scrolling
// back up brings the buttons and a slim name, with nothing behind them (step 11b).
export default function DetailHeader({
  title,
  hostName,
  isPublic,
  actions,
  onClose,
  children,
}: {
  title: string
  hostName: string
  isPublic: boolean
  actions?: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  return (
    <Headroom
      bar={
        <div className='flex items-center justify-between'>
          <span data-headroom-slim aria-hidden className='min-w-0 flex-1 truncate text-text-1 font-bold text-heading opacity-0 transition-opacity duration-200'>
            {title}
          </span>
          <div data-headroom-actions className='pointer-events-auto flex shrink-0 items-center gap-2 pl-3'>
            {actions}
            <IconButton icon={X} label='Schließen' onClick={onClose} />
          </div>
        </div>
      }
    >
      <div className='flex min-w-0 flex-col pr-(--headroom-actions)'>
        <h1 data-headroom-title className='text-heading-1 font-bold break-words text-heading'>{title}</h1>
        <span className='text-text-3 text-text'>von {hostName}</span>
        {!isPublic && <span className='text-text-3 text-yellow'>(Privat)</span>}
      </div>
      <div className='pt-4'>{children}</div>
    </Headroom>
  )
}
