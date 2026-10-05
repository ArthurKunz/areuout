'use client'

import type { ReactNode } from 'react'
import { Check, X } from 'lucide-react'
import type { Database } from '@/types/database.types'

export type HostedParty = Database['public']['Functions']['get_hosting_parties']['Returns'][number]

// DD.MM.YY in the viewer's time zone, the way the mockup shows it.
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })

const divider = <div className='ml-13 h-px rounded-full bg-divider' />

// The guest's answer on the right of a row (App Redesign 5.1). Hosting never shows one:
// the host has no RSVP, the database refuses the row.
const STATUS_ICON: Record<string, ReactNode> = {
  going: <Check size={22} />,
  maybe: <span className='text-[22px] font-bold leading-none'>?</span>,
  not_going: <X size={22} />,
}

// A tab's parties, soonest first (App Redesign 3.4): the ones the signed-in user hosts
// on Hosting, the ones they answered on My Parties, every party on Explore. The screen
// fetches them; null while loading. A tap on a row does what a tap on its circle does.
// Only My Parties shows the answer on the right; Explore turns it off.
export default function HostingList({
  parties,
  emptyText,
  showStatus = true,
  onSelect,
}: {
  parties: HostedParty[] | null
  emptyText: string
  showStatus?: boolean
  onSelect: (party: HostedParty) => void
}) {
  if (!parties) {
    return (
      <div className='flex flex-col'>
        {[0, 1, 2].map((i) => (
          <div key={i}>
            {i > 0 && divider}
            <div className='flex h-13 items-center gap-3'>
              <div className='size-10 shrink-0 rounded-full skeleton' />
              <div className='flex flex-col gap-1.5'>
                <div className='h-4 w-32 rounded-full skeleton' />
                <div className='h-3 w-16 rounded-full skeleton' />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (parties.length === 0) {
    return <p className='text-text-2 text-text'>{emptyText}</p>
  }

  return (
    <ul className='flex flex-col'>
      {parties.map((party, i) => (
        <li key={party.id}>
          {i > 0 && divider}
          <button type='button' onClick={() => onSelect(party)} className='flex h-13 w-full items-center gap-3 text-left'>
            {/* Uploaded covers are absolute Storage URLs, presets relative paths into
                /public; both work as src. */}
            <img src={party.background_url} alt='' className='size-10 shrink-0 rounded-full object-cover' />
            <div className='flex min-w-0 flex-1 flex-col'>
              <span className='truncate text-text-2 font-bold text-heading'>{party.title}</span>
              <span className='text-text-3 text-text'>{formatDate(party.event_date)}</span>
            </div>
            {showStatus && party.my_status && <span className='shrink-0 text-main-white'>{STATUS_ICON[party.my_status]}</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}
