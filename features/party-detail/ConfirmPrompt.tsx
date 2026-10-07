'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import BigButton from '@/components/shared/BigButton'
import Spinner from '@/components/shared/Spinner'

// A yes-or-cancel question over the whole screen, in the redesign's dark style. Same
// behaviour as components/shared/ConfirmDialog (held while the write runs, tap beside
// it cancels, page scroll locked); that one still uses colour tokens the redesign
// removed from globals.css, so it stays with the old screens. Rendered at the body: the
// container's transform would otherwise trap `position: fixed` inside it.
export default function ConfirmPrompt({
  title,
  message,
  confirmLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel: string
  pending: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  return createPortal(
    <div role='dialog' aria-modal='true' aria-labelledby='confirm-prompt-title' className='fixed inset-0 z-50 flex items-center justify-center px-7.5'>
      <button
        type='button'
        aria-label='Abbrechen'
        onClick={onCancel}
        disabled={pending}
        className='absolute inset-0 bg-main backdrop-blur-sm'
      />
      <div className='relative flex w-full max-w-80 flex-col items-center gap-5 rounded-[25px] bg-main p-5 glass-overlay animate-fade-in-up'>
        <div className='flex flex-col gap-1.5 text-center'>
          <span id='confirm-prompt-title' className='text-heading-4 font-bold text-heading'>
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
