'use client'

import type { Database } from '@/types/database.types'

export type HostedParty = Database['public']['Functions']['get_hosting_parties']['Returns'][number]

// DD.MM.YY in the viewer's time zone, the way the mockup shows it.
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })

const divider = <div className='ml-13 h-px rounded-full bg-divider' />

// The parties the signed-in user hosts, soonest first (App Redesign 3.4). HostingScreen
// fetches them; null while loading. A tap on a row does what a tap on its circle does.
export default function HostingList({
  parties,
  onSelect,
}: {
  parties: HostedParty[] | null
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
    return <p className='text-text-2 text-text'>Du hostest gerade keine Party</p>
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
            <div className='flex min-w-0 flex-col'>
              <span className='truncate text-text-2 font-bold text-heading'>{party.title}</span>
              <span className='text-text-3 text-text'>{formatDate(party.event_date)}</span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}
