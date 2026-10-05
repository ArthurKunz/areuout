'use client'

import { useEffect, useState } from 'react'
import ListHeader from '@/components/shell/ListHeader'
import { HideShell } from '@/components/shell/Shell'
import { useShellMap } from '@/components/shell/MapContext'
import HostingList, { type HostedParty } from '@/features/hosting/HostingList'
import PartyMarkers from '@/features/hosting/PartyMarkers'
import PartyDetail, { isRsvpStatus, type Viewer } from '@/features/party-detail/PartyDetail'
import { supabase } from '@/lib/supabase/client'
import { alertError } from '@/lib/utils'

// The Explore tab (App Redesign 4): every upcoming party, public and private, own and
// answered ones included, as circles on the map and rows in the list. Works like
// Hosting: a tap on either flies to the party and swaps the list for the detail.
// get_explore_parties already applies the 24-hour rule, sorts, and hands out the blurred
// point instead of the exact one wherever the viewer may not see the address.
export default function ExploreScreen() {
  const { flyTo } = useShellMap()
  const [parties, setParties] = useState<HostedParty[] | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  // The viewer is fixed when the party opens, so joining it does not reload the detail;
  // the detail itself follows my_status from there.
  const [selected, setSelected] = useState<{ id: string; viewer: Viewer } | null>(null)

  useEffect(() => {
    Promise.all([supabase.rpc('get_explore_parties'), supabase.auth.getSession()]).then(([explore, session]) => {
      if (explore.error) {
        alertError('Die Partys konnten nicht geladen werden.', explore.error.message)
        setParties([])
        return
      }
      setUserId(session.data.session?.user.id ?? null)
      setParties(explore.data)
    })
  }, [])

  // From the data: the host is whoever host_id names, a guest has an RSVP; everyone
  // else, a pending request included, is a stranger.
  const select = ({ id }: { id: string }) => {
    const party = parties?.find((item) => item.id === id)
    if (!party) return
    flyTo(party.lng, party.lat)
    const viewer: Viewer = party.host_id === userId ? 'host' : isRsvpStatus(party.my_status) ? 'guest' : 'stranger'
    setSelected({ id, viewer })
  }

  const open = selected && parties?.some((party) => party.id === selected.id) ? selected : null

  return (
    <>
      {parties && <PartyMarkers parties={parties} selectedId={open?.id ?? null} onSelect={select} />}
      {open ? (
        <>
          <HideShell />
          <PartyDetail
            key={open.id}
            partyId={open.id}
            viewer={open.viewer}
            onClose={() => setSelected(null)}
            onDeleted={() => {
              setParties((current) => current?.filter((party) => party.id !== open.id) ?? null)
              setSelected(null)
            }}
          />
        </>
      ) : (
        <>
          <ListHeader title='Explore' />
          {/* The bottom padding lets the list scroll out from under the navigation. */}
          <div className='min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-25'>
            <HostingList parties={parties} emptyText='Gerade gibt es keine Party' showStatus={false} onSelect={select} />
          </div>
        </>
      )}
    </>
  )
}
