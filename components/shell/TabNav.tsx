'use client'

import Link from 'next/link'
import type { Ref } from 'react'
import { CalendarDays, CircleUserRound, Heart, House } from 'lucide-react'

export const TABS = [
  { href: '/explore', label: 'Explore', Icon: House },
  { href: '/my-parties', label: 'My Parties', Icon: Heart },
  { href: '/hosting', label: 'Hosting', Icon: CalendarDays },
  { href: '/me', label: 'Profile', Icon: CircleUserRound },
] as const

// The floating bar of the four main screens, as wide as the container and 75px tall. Its scale between the open and
// collapsed container is set by Sheet through the ref, frame by frame.
export default function TabNav({
  ref,
  pathname,
  onSelect,
}: {
  ref: Ref<HTMLElement>
  pathname: string
  // Every tap opens the container: on another tab after navigating, on the active
  // tab instead of navigating.
  onSelect: () => void
}) {
  const activeIndex = TABS.findIndex((tab) => tab.href === pathname)

  return (
    <nav
      ref={ref}
      className='fixed inset-x-0 bottom-nav-bottom z-20 mx-auto h-nav-height w-shell-width origin-bottom md:left-sheet-gutter md:mx-0 rounded-full bg-main p-2 glass-surface [--glass-blur:var(--blur-nav)] [--glass-shadow:var(--glass-nav-shadow)] will-change-transform'
    >
      <div className='relative flex h-full'>
        {/* The selector slides between items instead of jumping per item */}
        {activeIndex >= 0 && (
          <span
            aria-hidden
            className='absolute inset-y-0 left-0 w-1/4 rounded-full bg-nav-selector transition-transform duration-(--duration-move) ease-ios'
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
          />
        )}

        {TABS.map(({ href, label, Icon }, index) => {
          const active = index === activeIndex
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              onClick={(event) => {
                if (active) event.preventDefault()
                onSelect()
              }}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 transition-[color,scale] duration-(--duration-press) ease-ios active:scale-95 ${
                active ? 'text-brand' : 'text-main-white'
              }`}
            >
              <Icon size={24} strokeWidth={2} />
              <span className='text-text-4 font-semibold'>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
