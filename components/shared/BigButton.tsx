'use client'

import type { ReactNode } from 'react'

const VARIANT_CLASS = {
  white: 'bg-main-white text-heading-black',
  red: 'bg-red text-main-white',
  green: 'bg-green text-heading',
  main: 'bg-main text-heading',
} as const

// The 350x50 full-width action button (Anfragen, Log out, Account löschen),
// in one of four fixed colour variants.
export default function BigButton({
  variant,
  children,
  onClick,
  type = 'button',
}: {
  variant: keyof typeof VARIANT_CLASS
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`flex h-[50px] w-[350px] items-center justify-center rounded-full text-text-1 font-semibold backdrop-blur-[100px] ${VARIANT_CLASS[variant]}`}
    >
      {children}
    </button>
  )
}
