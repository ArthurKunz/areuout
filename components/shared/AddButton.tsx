'use client'

import { Plus } from 'lucide-react'

// The 50px-tall (at most 350px wide) pill used to add a question or poll: green 25x25 plus circle,
// label to its right. Same background, radius and blur as Input.
export default function AddButton({
  label,
  onClick,
}: {
  label: string
  onClick?: () => void
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className='flex h-[50px] w-full max-w-[350px] items-center gap-3 rounded-full bg-main px-4 glass-control transition-transform duration-(--duration-press) ease-ios active:scale-95'
    >
      <span className='flex h-[25px] w-[25px] shrink-0 items-center justify-center rounded-full bg-green'>
        <Plus size={20} className='text-main-white' />
      </span>
      <span className='text-text-3 font-semibold text-heading'>{label}</span>
    </button>
  )
}
