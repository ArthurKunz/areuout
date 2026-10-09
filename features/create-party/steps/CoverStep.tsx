'use client'

import { useRef, useState } from 'react'
import StepFrame from '../StepFrame'
import ImageUploadCircle from '@/components/shared/ImageUploadCircle'
import WarningBanner from '@/components/shared/WarningBanner'
import { BG_MAX_BYTES, COVER_PRESETS } from '@/features/parties/constants/background.constants'
import { canLeaveCover, type PartyDraft } from '../draft'

// Step 4: an own picture or one of six presets, never both (mockup Create 05). Choosing
// only selects; weiter leads on. The flow revokes a replaced upload's preview URL. Edit
// Party opens it as a sub-screen: back only, its own button label, and the party's
// current own picture in the circle.
export default function CoverStep({
  draft,
  update,
  onNext,
  onBack,
  onClose,
  buttonLabel = 'weiter',
}: {
  draft: PartyDraft
  update: (patch: Partial<PartyDraft>) => void
  onNext: () => void
  onBack: () => void
  onClose?: () => void
  buttonLabel?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const { cover } = draft

  // The same checks and wording as the old create flow.
  const pickFile = (picked: File | null) => {
    setError(null)
    if (!picked) return
    if (!picked.type.startsWith('image/')) {
      setError('Bitte ein Bild (JPG, PNG, …) auswählen.')
      return
    }
    if (picked.size > BG_MAX_BYTES) {
      setError('Die Datei darf höchstens 10 MB groß sein.')
      return
    }
    update({ cover: { kind: 'upload', file: picked, previewUrl: URL.createObjectURL(picked) } })
  }

  return (
    <StepFrame
      title='Partycover'
      onClose={onClose}
      onBack={onBack}
      button={{ label: buttonLabel, onClick: onNext, disabled: !canLeaveCover(draft) }}
    >
      <ImageUploadCircle
        imageUrl={cover?.kind === 'upload' ? cover.previewUrl : cover?.kind === 'current' ? cover.url : null}
        onClick={() => inputRef.current?.click()}
        label='Eigenes Bild auswählen'
      />
      <input
        ref={inputRef}
        type='file'
        accept='image/*'
        className='hidden'
        onChange={(e) => {
          pickFile(e.target.files?.[0] ?? null)
          // Cleared so picking the same file again still fires a change.
          e.target.value = ''
        }}
      />
      {error && <WarningBanner message={error} />}

      <div role='radiogroup' aria-label='Vorlagen' className='mt-5 grid grid-cols-3 gap-x-6 gap-y-3'>
        {COVER_PRESETS.map((url, i) => {
          const selected = cover?.kind === 'preset' && cover.url === url
          return (
            <button
              key={url}
              type='button'
              role='radio'
              aria-checked={selected}
              aria-label={`Vorlage ${i + 1}`}
              onClick={() => {
                setError(null)
                update({ cover: { kind: 'preset', url } })
              }}
              className='flex flex-col items-center gap-1 transition-transform duration-(--duration-press) ease-ios active:scale-95'
            >
              <img src={url} alt='' className='size-18 rounded-full object-cover' />
              <span className='flex size-4.5 items-center justify-center rounded-full border border-heading'>
                <span
                  className={`size-2.5 rounded-full bg-heading transition-[opacity,scale] duration-(--duration-press) ease-ios ${selected ? '' : 'scale-50 opacity-0'}`}
                />
              </span>
            </button>
          )
        })}
      </div>
    </StepFrame>
  )
}
