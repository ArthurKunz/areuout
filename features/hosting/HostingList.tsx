'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { alertError } from '@/lib/utils'
import type { Database } from '@/types/database.types'

type HostedParty = Database['public']['Functions']['get_hosting_parties']['Returns'][number]

// DD.MM.YY in the viewer's time zone, the way the mockup shows it.
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })

const divider = <div className='ml-13 h-px rounded-full bg-divider' />

// The parties the signed-in user hosts, soonest first (App Redesign 3.4). Fetched in the
// browser on every mount, so a party created a moment ago is always in it, however the
// router got here. Rows are not tappable yet; the detail comes in step 4.
export default function HostingList() {
  const [parties, setParties] = useState<HostedParty[] | null>(null)

  useEffect(() => {
    supabase.rpc('get_hosting_parties').then(({ data, error }) => {
      if (error) {
        alertError('Deine Partys konnten nicht geladen werden.', error.message)
        setParties([])
        return
      }
      setParties([...data].sort((a, b) => a.event_date.localeCompare(b.event_date)))
    })
  }, [])

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
          <div className='flex h-13 items-center gap-3'>
            {/* Uploaded covers are absolute Storage URLs, presets relative paths into
                /public; both work as src. */}
            <img src={party.background_url} alt='' className='size-10 shrink-0 rounded-full object-cover' />
            <div className='flex min-w-0 flex-col'>
              <span className='truncate text-text-2 font-bold text-heading'>{party.title}</span>
              <span className='text-text-3 text-text'>{formatDate(party.event_date)}</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
