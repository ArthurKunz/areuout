'use client'

import type { ReactNode } from 'react'
import { ChevronLeft, X } from 'lucide-react'
import IconButton from '@/components/shared/IconButton'
import BigButton from '@/components/shared/BigButton'

// The frame every create step shares (App Redesign 7.1): back on the left, the title
// centred, ✗ on the right, a scrolling body, and the one action at the bottom. An
// empty 45px slot stands in for a missing button so the title stays centred.
export default function StepFrame({
  title,
  onClose,
  onBack,
  button,
  children,
}: {
  // A string becomes the heading; anything else (a Chip on the feature sub-steps) is
  // rendered as given.
  title: ReactNode
  onClose?: () => void
  onBack?: () => void
  button: { label: ReactNode; onClick: () => void; disabled?: boolean } | null
  children: ReactNode
}) {
  return (
    <>
      <div className='flex h-11.25 shrink-0 items-center justify-between gap-3 px-5'>
        {onBack ? <IconButton icon={ChevronLeft} label='Zurück' onClick={onBack} /> : <span className='size-11.25 shrink-0' />}
        {typeof title === 'string' ? (
          <h1 className='min-w-0 truncate text-center text-heading-3 font-bold text-heading'>{title}</h1>
        ) : (
          title
        )}
        {onClose ? <IconButton icon={X} label='Schließen' onClick={onClose} /> : <span className='size-11.25 shrink-0' />}
      </div>

      {/* As tall as its content (flex-auto, not flex-1: the fitted container has no
          height of its own to share out), shrinking and scrolling only once the
          container reaches its maximum. Children never shrink: in a flex column they
          would otherwise be squeezed and spill out under the button instead of
          scrolling. Every child is full width up to 350px, so the side padding is the
          same everywhere; overflow-x-hidden is only a safety net. */}
      <div className='flex min-h-0 flex-auto flex-col items-center gap-4 overflow-y-auto overflow-x-hidden px-5 pt-6 pb-4 *:shrink-0'>
        {children}
      </div>

      {button && (
        <div className='flex shrink-0 justify-center px-5 pt-2 pb-6'>
          <BigButton variant='white' onClick={button.onClick} disabled={button.disabled}>
            {button.label}
          </BigButton>
        </div>
      )}
    </>
  )
}
