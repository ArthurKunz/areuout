'use client'

import { Plus } from 'lucide-react'

// The 350x50 pill used to add a question or poll: green 25x25 plus circle,
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
      className='flex h-[50px] w-[350px] items-center gap-3 rounded-full bg-main px-4 backdrop-blur-[100px]'
    >
      <span className='flex h-[25px] w-[25px] shrink-0 items-center justify-center rounded-full bg-green'>
        <Plus size={20} className='text-main-white' />
      </span>
      <span className='text-text-3 font-semibold text-heading'>{label}</span>
    </button>
  )
}
