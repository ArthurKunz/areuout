'use client'

import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import BigButton from '@/components/shared/BigButton'
import Spinner from '@/components/shared/Spinner'

// A yes-or-cancel question over the whole screen, in the redesign's dark style: held
// while the write runs, tap beside it cancels, page scroll locked. Rendered at the body:
// the container's transform would otherwise trap `position: fixed` inside it.
export default function ConfirmPrompt({
  open,
  title,
  message,
  confirmLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  // It stays rendered and shows while open (step 11d), so closing can play its exit.
  open: boolean
  title: string
  message: string
  confirmLabel: string
  pending: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  // Several prompts can be on the page at once, closed, so the title's id is per prompt.
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  return createPortal(
    // The layer itself takes no touches: closed, only it is left on the page.
    <div className='pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-7.5'>
      <button
        type='button'
        aria-label='Abbrechen'
        onClick={onCancel}
        disabled={pending}
        data-open={open || undefined}
        className='pop-fade pointer-events-auto absolute inset-0 bg-main backdrop-blur-sm'
      />
      {/* A modal is not anchored to a trigger, so it grows from its centre. */}
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        data-open={open || undefined}
        className='pop pointer-events-auto relative flex w-full max-w-80 flex-col items-center gap-5 rounded-[25px] bg-main p-5 glass-overlay'
      >
        <div className='flex flex-col gap-1.5 text-center'>
          <span id={titleId} className='text-heading-4 font-bold text-heading'>
            {title}
          </span>
          <span className='text-text-3 text-text'>{message}</span>
        </div>
        <div className='flex w-full flex-col items-center gap-2'>
          <BigButton variant='red' onClick={onConfirm} disabled={pending}>
            {pending ? <Spinner /> : confirmLabel}
          </BigButton>
          <BigButton variant='main' onClick={onCancel} disabled={pending}>
            Abbrechen
          </BigButton>
        </div>
      </div>
    </div>,
    document.body
  )
}
