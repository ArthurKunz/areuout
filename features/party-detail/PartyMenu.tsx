'use client'

import { useEffect, useRef, useState } from 'react'
import { Ellipsis, Flag } from 'lucide-react'
import IconButton from '@/components/shared/IconButton'
import ReportPrompt from './ReportPrompt'

const menuItem = 'flex h-11 w-full items-center gap-3 px-4 text-text-1'

// ⋯ for everyone but the host (step 13b), left of the RSVP button: the host's menu
// (HostActions) with one item, `Party melden`, which reports the party and its host.
export default function PartyMenu({ partyId, hostId }: { partyId: string; hostId: string }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [reporting, setReporting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // A tap anywhere outside the menu closes it.
  useEffect(() => {
    if (!menuOpen) return
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [menuOpen])

  return (
    <>
      <div ref={menuRef} className='relative'>
        <IconButton icon={Ellipsis} label='Mehr' onClick={() => setMenuOpen((open) => !open)} />
        {/* Grows out of the ⋯ above its right edge. */}
        <div
          role='menu'
          data-open={menuOpen || undefined}
          className='pop absolute top-full right-0 z-20 mt-2 w-max origin-top-right overflow-hidden rounded-[20px] bg-main py-1 glass-overlay'
        >
          <button
            type='button'
            role='menuitem'
            onClick={() => {
              setMenuOpen(false)
              setReporting(true)
            }}
            className={`${menuItem} text-red`}
          >
            <Flag size={22} />
            Party melden
          </button>
        </div>
      </div>
      <ReportPrompt
        open={reporting}
        title='Party melden'
        target={{ kind: 'party', reportedUserId: hostId, eventId: partyId }}
        onClose={() => setReporting(false)}
      />
    </>
  )
}
