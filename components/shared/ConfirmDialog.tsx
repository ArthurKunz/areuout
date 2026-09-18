'use client'

import { useEffect } from 'react'
import Spinner from '@/components/shared/Spinner'

// Ein confirm() kann nicht warten: sobald der Host bestätigt hat, läuft ein Schreibvorgang,
// und bis der durch ist, muss etwas zu sehen sein. Deshalb ein eigener Dialog — sonst die
// gleiche Bauweise wie UnsavedChangesDialog, nur mit zwei Antworten statt drei.
export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  pending = false,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel: string
  // Gehalten, solange der Schreibvorgang hinter dem Dialog noch läuft, damit der Dialog
  // nicht unter einer laufenden Anfrage weggezogen wird.
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  // Die Seite dahinter darf nicht scrollen, solange das hier steht — dieselbe Sperre,
  // die Wheel-Picker und der Auth-Gate der Invite-Seite schon benutzen.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-labelledby='confirm-title'
      className='fixed inset-0 z-50 flex items-center justify-center px-7.5'
    >
      {/* Daneben tippen heißt abbrechen, wie im Dialog selbst. */}
      <button
        type='button'
        aria-label='Abbrechen'
        onClick={onCancel}
        disabled={pending}
        className='absolute inset-0 bg-main/60 backdrop-blur-sm'
      />

      <div className='relative w-full max-w-80 flex flex-col gap-5 rounded-[25px] bg-quaternary backdrop-blur-2xl p-5 animate-fade-in-up'>
        <div className='flex flex-col gap-1.5 text-center'>
          <span id='confirm-title' className='text-heading-4 font-semibold text-heading'>
            {title}
          </span>
          <span className='text-subheading-1 text-subheading'>{message}</span>
        </div>

        <div className='flex flex-col gap-2'>
          {/* Die rote Pille trägt die Antwort, die etwas kostet. */}
          <button
            type='button'
            onClick={onConfirm}
            disabled={pending}
            className='flex h-12.5 w-full items-center justify-center rounded-full border border-warning/60 bg-warning/15 backdrop-blur-xl text-button font-semibold text-warning transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95 disabled:opacity-50'
          >
            {pending ? <Spinner /> : confirmLabel}
          </button>

          <button
            type='button'
            onClick={onCancel}
            disabled={pending}
            className='flex h-12.5 w-full items-center justify-center rounded-full bg-secondary backdrop-blur-xl text-button text-label-large transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95 disabled:opacity-50'
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}
