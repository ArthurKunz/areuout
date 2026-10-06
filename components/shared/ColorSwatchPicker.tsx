'use client'

import { Check } from 'lucide-react'

const COLOR_CLASS = {
  orange: 'bg-orange',
  red: 'bg-red',
  mint: 'bg-mint',
  purple: 'bg-purple',
  yellow: 'bg-yellow',
  green: 'bg-green',
  blue: 'bg-blue',
} as const

export type SwatchColor = keyof typeof COLOR_CLASS

// The row of 25x25 colour circles used to pick a profile/party background
// colour (e.g. when no picture is uploaded). The selected swatch shows a
// check instead of being otherwise highlighted.
export default function ColorSwatchPicker({
  value,
  onChange,
}: {
  // Null: nothing is ticked yet.
  value: SwatchColor | null
  onChange: (next: SwatchColor) => void
}) {
  return (
    <div className='flex items-center gap-3'>
      {(Object.keys(COLOR_CLASS) as SwatchColor[]).map((color) => (
        <button
          key={color}
          type='button'
          onClick={() => onChange(color)}
          aria-label={color}
          className={`flex h-[25px] w-[25px] shrink-0 items-center justify-center rounded-full ${COLOR_CLASS[color]}`}
        >
          {value === color && <Check size={14} strokeWidth={3} className='text-main-white' />}
        </button>
      ))}
    </div>
  )
}
