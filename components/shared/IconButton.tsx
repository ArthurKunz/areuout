'use client'

import type { LucideIcon } from 'lucide-react'

// The circular 45x45 chrome button used for menu, back, share, plus and close
// actions. The icon itself (24x24) is passed in so this stays a single component.
export default function IconButton({
  icon: Icon,
  label,
  onClick,
  type = 'button',
}: {
  icon: LucideIcon
  label: string
  onClick?: () => void
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      aria-label={label}
      className='flex h-[45px] w-[45px] shrink-0 items-center justify-center rounded-full bg-button-circle text-main-white backdrop-blur-xl transition-transform duration-200 active:scale-90'
    >
      <Icon size={24} />
    </button>
  )
}
