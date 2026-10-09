'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import IconButton from '@/components/shared/IconButton'

// The detail's header (App Redesign 3.5) at the top of its scrolling cards: the name
// large and bold, `von` and the host in grey, `(Privat)` in yellow for private parties
// only. Top right the viewer's buttons, then ✗. It scrolls away with the cards and
// nothing takes its place; closing means scrolling back to the top (step 11b).
export default function DetailHeader({
  title,
  hostName,
  isPublic,
  actions,
  onClose,
  onHost,
  children,
}: {
  title: string
  hostName: string
  isPublic: boolean
  actions?: ReactNode
  onClose: () => void
  // Opens the host's profile; left out when the viewer is the host.
  onHost?: () => void
  children: ReactNode
}) {
  return (
    // Up to the container's top edge: cards scroll on under the rounded corners instead
    // of being cut 24px below them.
    <div className='-mt-6 min-h-0 flex-1 overflow-y-auto px-5 pt-6 pb-5'>
      <div className='relative z-10 flex items-start justify-between gap-3'>
        <div className='flex min-w-0 flex-col'>
          <h1 className='text-heading-1 font-bold break-words text-heading'>{title}</h1>
          <span className='text-text-3 text-text'>
            von{' '}
            {onHost ? (
              <button type='button' onClick={onHost} className='transition-opacity duration-(--duration-press) ease-ios active:opacity-60'>
                {hostName}
              </button>
            ) : (
              hostName
            )}
          </span>
          {!isPublic && <span className='text-text-3 text-yellow'>(Privat)</span>}
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          {actions}
          <IconButton icon={X} label='Schließen' onClick={onClose} />
        </div>
      </div>
      <div className='pt-4'>{children}</div>
    </div>
  )
}
