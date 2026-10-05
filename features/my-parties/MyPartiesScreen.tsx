'use client'

import { useEffect, useState } from 'react'
import ListHeader from '@/components/shell/ListHeader'
import { HideShell } from '@/components/shell/Shell'
import { useShellMap } from '@/components/shell/MapContext'
import HostingList, { type HostedParty } from '@/features/hosting/HostingList'
import PartyMarkers from '@/features/hosting/PartyMarkers'
import PartyDetail from '@/features/party-detail/PartyDetail'
import { supabase } from '@/lib/supabase/client'
import { alertError } from '@/lib/utils'

// The My Parties tab (App Redesign 5): every party the user answered, whatever the
// answer, plus every party they asked to join, as circles on the map and rows in the
// list with the answer (or the clock) on the right. A pending request keeps the blurred
// point, so its pin gets the radar like everywhere else (App Redesign 5.2).
// Works like Hosting: a tap on either flies to the party and swaps the list for the
// detail, where the RSVP button changes the answer and this list follows it.
// get_my_parties already applies the 24-hour rule, sorts, and never returns own parties.
export default function MyPartiesScreen() {
  const { flyTo } = useShellMap()
  const [parties, setParties] = useState<HostedParty[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('get_my_parties').then(({ data, error }) => {
      if (error) {
        alertError('Deine Partys konnten nicht geladen werden.', error.message)
        setParties([])
        return
      }
      setParties(data)
    })
  }, [])

  const select = (party: { id: string; lat: number; lng: number }) => {
    flyTo(party.lng, party.lat)
    setSelectedId(party.id)
  }

  const selected = parties?.find((party) => party.id === selectedId) ?? null

  return (
    <>
      {parties && <PartyMarkers parties={parties} selectedId={selected?.id ?? null} onSelect={select} />}
      {selected ? (
        <>
          <HideShell />
          <PartyDetail
            key={selected.id}
            partyId={selected.id}
            viewer='guest'
            onClose={() => setSelectedId(null)}
            onLoaded={(row) => {
              // An accepted request: the exact point and the answer replace the blurred
              // point and the clock.
              setParties((current) =>
                current?.map((party) =>
                  party.id === row.id
                    ? { ...party, lat: row.lat, lng: row.lng, is_exact: row.is_exact, my_status: row.my_status }
                    : party
                ) ?? null
              )
              if (row.lat !== selected.lat || row.lng !== selected.lng) flyTo(row.lng, row.lat)
            }}
            onStatusChange={(status) =>
              setParties((current) =>
                current?.map((party) => (party.id === selected.id ? { ...party, my_status: status } : party)) ?? null
              )
            }
          />
        </>
      ) : (
        <>
          <ListHeader title='My Parties' />
          {/* The bottom padding lets the list scroll out from under the navigation. */}
          <div className='min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-25'>
            <HostingList parties={parties} emptyText='Du bist gerade auf keiner Party' onSelect={select} />
          </div>
        </>
      )}
    </>
  )
}
