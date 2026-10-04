'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import IconButton from '@/components/shared/IconButton'
import { supabase } from '@/lib/supabase/client'
import { alertError } from '@/lib/utils'
import DetailCards, { type PartyDetailRow, type PartyPollRow } from './DetailCards'
import DetailHeader from './DetailHeader'
import HostActions from './HostActions'

// Who is looking. Decides the header's buttons; get_party_detail and get_party_polls
// already decide what each viewer may see. Only the host's header exists so far: the
// guest's RSVP button comes in step 6, the stranger has ✗ alone.
export type Viewer = 'host' | 'guest' | 'stranger'

type Loaded = { party: PartyDetailRow; polls: PartyPollRow[]; inviteCode: string | null }

// The party detail container (App Redesign 3.5), built once for every place that opens
// a party: Hosting now; Explore, My Parties and the invite page later. It replaces the
// list inside the same container, which keeps its height; the header stays and the
// cards scroll. The caller hides the navigation while it is open.
export default function PartyDetail({
  partyId,
  viewer,
  onClose,
  onDeleted,
}: {
  partyId: string
  viewer: Viewer
  // ✗: the caller shows its list again.
  onClose: () => void
  // Host only: the party is gone; the caller drops it from its list and map.
  onDeleted?: () => void
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.rpc('get_party_detail', { p_event_id: partyId }).maybeSingle(),
      supabase.rpc('get_party_polls', { p_event_id: partyId }),
      // No function returns the invite code: only the host reads it, from the row.
      viewer === 'host'
        ? supabase.from('events').select('invite_code').eq('id', partyId).single()
        : Promise.resolve({ data: null, error: null }),
    ]).then(([detail, polls, invite]) => {
      if (cancelled) return
      const error = detail.error ?? polls.error ?? invite.error
      if (error || !detail.data) {
        alertError('Die Party konnte nicht geladen werden.', error?.message)
        onClose()
        return
      }
      setLoaded({ party: detail.data, polls: polls.data ?? [], inviteCode: invite.data?.invite_code ?? null })
    })
    return () => {
      cancelled = true
    }
    // onClose changes identity on every render of the caller; the load depends on the
    // party and the viewer only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId, viewer])

  if (!loaded) {
    return (
      <div className='flex min-h-0 flex-1 flex-col'>
        <div className='flex shrink-0 items-start justify-between gap-3 px-5'>
          <div className='flex flex-col gap-2 pt-1'>
            <div className='h-6 w-40 rounded-full skeleton' />
            <div className='h-3.5 w-24 rounded-full skeleton' />
          </div>
          <IconButton icon={X} label='Schließen' onClick={onClose} />
        </div>
        <div className='grid grid-cols-2 gap-2.5 px-5 pt-4'>
          <div className='h-28 rounded-[25px] skeleton' />
          <div className='h-28 rounded-[25px] skeleton' />
          <div className='col-span-2 h-28 rounded-[25px] skeleton' />
        </div>
      </div>
    )
  }

  const { party, polls, inviteCode } = loaded

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <DetailHeader
        title={party.title}
        hostName={`${party.host_firstname} ${party.host_lastname}`}
        isPublic={party.is_public}
        onClose={onClose}
        actions={
          viewer === 'host' && inviteCode ? (
            <HostActions
              partyId={party.id}
              hostId={party.host_id}
              title={party.title}
              inviteCode={inviteCode}
              onInviteCode={(code) => setLoaded({ ...loaded, inviteCode: code })}
              onDeleted={() => onDeleted?.()}
            />
          ) : undefined
        }
      />
      <div className='min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-5'>
        <DetailCards party={party} polls={polls} />
      </div>
    </div>
  )
}
