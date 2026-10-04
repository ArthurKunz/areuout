'use client'

import { useEffect, useState } from 'react'
import ListHeader from '@/components/shell/ListHeader'
import { HideShell } from '@/components/shell/Shell'
import { useShellMap } from '@/components/shell/MapContext'
import PartyDetail from '@/features/party-detail/PartyDetail'
import { supabase } from '@/lib/supabase/client'
import { alertError } from '@/lib/utils'
import HostingList, { type HostedParty } from './HostingList'
import PartyMarkers from './PartyMarkers'

// Mirrors the open party into the address bar without a navigation, so coming back
// from Edit Party (or a refresh) reopens it. Next keeps useSearchParams in sync with
// this (node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md).
const showInUrl = (id: string | null) =>
  window.history.replaceState(null, '', id ? `/hosting?party=${encodeURIComponent(id)}` : '/hosting')

// The Hosting tab (App Redesign 6): the hosted parties as circles on the map and as
// rows in the list. A tap on either flies to the party, turns its circle into the pin
// and swaps the list for the detail in the same container; ✗ swaps back and leaves the
// map where it is. Fetched in the browser on every mount, so a party created a moment
// ago is always in it, however the router got here.
export default function HostingScreen({ initialParty }: { initialParty: string | null }) {
  const { flyTo } = useShellMap()
  const [parties, setParties] = useState<HostedParty[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(initialParty)

  useEffect(() => {
    supabase.rpc('get_hosting_parties').then(({ data, error }) => {
      if (error) {
        alertError('Deine Partys konnten nicht geladen werden.', error.message)
        setParties([])
        return
      }
      const sorted = [...data].sort((a, b) => a.event_date.localeCompare(b.event_date))
      setParties(sorted)
      // A party from the address that is gone (deleted, or past the 24 hours) simply
      // leaves the list showing.
      const initial = sorted.find((party) => party.id === initialParty)
      if (initial) flyTo(initial.lng, initial.lat)
      else if (initialParty) {
        setSelectedId(null)
        showInUrl(null)
      }
    })
  }, [initialParty, flyTo])

  const select = (party: { id: string; lat: number; lng: number }) => {
    flyTo(party.lng, party.lat)
    setSelectedId(party.id)
    showInUrl(party.id)
  }

  const close = () => {
    setSelectedId(null)
    showInUrl(null)
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
            viewer='host'
            onClose={close}
            onDeleted={() => {
              setParties((current) => current?.filter((party) => party.id !== selected.id) ?? null)
              close()
            }}
          />
        </>
      ) : (
        <>
          <ListHeader title='Hosting' />
          {/* The bottom padding lets the list scroll out from under the navigation. */}
          <div className='min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-25'>
            <HostingList parties={parties} onSelect={select} />
          </div>
        </>
      )}
    </>
  )
}
