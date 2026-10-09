'use client'

import { useEffect, useRef, useState } from 'react'
import RsvpStatusButton from '@/features/parties/components/RsvpStatusButton'
import RsvpStatusMenu from '@/features/parties/components/RsvpStatusMenu'
import { setRsvp } from '@/features/parties/services/parties.service'
import type { RsvpStatus } from '@/features/parties/types/parties.types'
import { supabase } from '@/lib/supabase/client'
import { alertError } from '@/lib/utils'

// The guest's RSVP button in the detail header (App Redesign 3.5): the colour of the
// current answer, and a tap opens the small dark menu beside it (mockup My Parties 08).
// The choice shows at once and is written through the same upsert as everywhere else;
// if the write fails the old answer comes back. A full party refuses `zugesagt` in the
// database, and its message `Diese Party ist voll.` reaches the alert.
export default function RsvpControl({
  partyId,
  initialStatus,
  over,
  onStatusChange,
}: {
  partyId: string
  initialStatus: RsvpStatus
  // The party is over: the answer still shows, but there is nothing left to answer.
  over: boolean
  onStatusChange?: (status: RsvpStatus) => void
}) {
  const [status, setStatus] = useState(initialStatus)
  // The same answer can be on screen twice: the detail stays mounted under its pages
  // (step 11d), so the header's button sits under the one on Teilnehmer. Whichever was
  // tapped, the other follows the shared answer.
  const [shared, setShared] = useState(initialStatus)
  if (initialStatus !== shared) {
    setShared(initialStatus)
    setStatus(initialStatus)
  }
  const [open, setOpen] = useState(false)
  const [writing, setWriting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // A tap anywhere outside closes the menu.
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const choose = async (next: RsvpStatus) => {
    if (writing || next === status) return
    const previous = status
    setWriting(true)
    setStatus(next)
    onStatusChange?.(next)
    // Without a session the policy refuses the row, and the rollback below handles it.
    const { data: { session } } = await supabase.auth.getSession()
    const { error } = await setRsvp(partyId, session?.user.id ?? '', next)
    setWriting(false)
    if (error) {
      setStatus(previous)
      onStatusChange?.(previous)
      setOpen(false)
      alertError('Deine Antwort konnte nicht gespeichert werden.', error.message)
      return
    }
    // Held open briefly so the tick visibly lands on the row that was tapped.
    setTimeout(() => setOpen(false), 600)
  }

  return (
    <div ref={ref} className='relative'>
      <RsvpStatusButton status={status} onClick={over ? undefined : () => setOpen((current) => !current)} />
      {/* Grows out of the button at its top right, and plays its exit on close. */}
      <div data-open={open || undefined} className='pop absolute top-0 right-full mr-2 origin-top-right'>
        <RsvpStatusMenu status={status} onSelect={choose} />
      </div>
    </div>
  )
}
