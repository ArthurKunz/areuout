'use client'

import { ImageUp, Pencil } from 'lucide-react'

// The 120x120 picture picker used for Profilbild and Partycover: an empty
// bg-main circle with an upload icon before a picture is chosen, the
// picture itself with an edit badge once one is. Both the empty circle and
// the chosen picture open the same picker, so this is one button — the
// edit badge is a decorative overlay (same look as IconButton), not a
// second nested control.
export default function ImageUploadCircle({
  imageUrl,
  onClick,
  label = 'Bild auswählen',
}: {
  imageUrl?: string | null
  onClick?: () => void
  label?: string
}) {
  if (!imageUrl) {
    return (
      <button
        type='button'
        onClick={onClick}
        aria-label={label}
        className='flex h-[120px] w-[120px] shrink-0 items-center justify-center rounded-full bg-main backdrop-blur-[100px]'
      >
        <ImageUp size={36} className='text-heading' />
      </button>
    )
  }
  return (
    <button type='button' onClick={onClick} aria-label={label} className='relative h-[120px] w-[120px] shrink-0'>
      <img src={imageUrl} alt='' className='h-full w-full rounded-full object-cover' />
      <span className='absolute -bottom-1 -right-1 flex h-[45px] w-[45px] items-center justify-center rounded-full bg-button-circle text-main-white backdrop-blur-xl'>
        <Pencil size={24} />
      </span>
    </button>
  )
}
