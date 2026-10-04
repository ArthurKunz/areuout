'use client'

import type { ReactNode } from 'react'

const VARIANT_CLASS = {
  white: 'bg-main-white text-heading-black',
  red: 'bg-red text-main-white',
  green: 'bg-green text-heading',
  main: 'bg-main text-heading',
} as const

// The 50px-tall (at most 350px wide) full-width action button (Anfragen, Log out, Account löschen),
// in one of four fixed colour variants.
export default function BigButton({
  variant,
  children,
  onClick,
  type = 'button',
  disabled,
}: {
  variant: keyof typeof VARIANT_CLASS
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-[50px] w-full max-w-[350px] items-center justify-center rounded-full text-text-1 font-semibold backdrop-blur-[100px] transition-opacity duration-200 disabled:opacity-40 ${VARIANT_CLASS[variant]}`}
    >
      {children}
    </button>
  )
}
