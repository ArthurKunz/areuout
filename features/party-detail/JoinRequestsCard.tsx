'use client'

import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import Avatar from '@/components/shared/Avatar'
import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'
import { alertError } from '@/lib/utils'
import { InfoCard } from './DetailCards'

export type JoinRequest = Database['public']['Functions']['get_party_join_requests']['Returns'][number]

const fullName = (request: JoinRequest) => [request.firstname, request.lastname].filter(Boolean).join(' ') || 'Unbekannt'

const pill = 'flex h-8 shrink-0 items-center rounded-full px-3 text-text-3 font-semibold text-heading transition-opacity duration-200 disabled:opacity-40'

// The host's card `Anfragen` (App Redesign 6.3, Join Request 7): one row per person who
// asked, oldest first as get_party_join_requests returns them, built like the guest
// list's rows. `Annehmen` runs accept_join_request, which sets the person to zugesagt;
// `Ablehnen` deletes the request through join_requests_delete_host, and the person may
// ask again. Either way the row goes; once none is left the card goes with it.
export default function JoinRequestsCard({ partyId, initial }: { partyId: string; initial: JoinRequest[] }) {
  const [requests, setRequests] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)

  const answer = async (request: JoinRequest, accept: boolean) => {
    setBusy(request.user_id)
    const { error } = accept
      ? await supabase.rpc('accept_join_request', { p_event_id: partyId, p_user_id: request.user_id })
      : await supabase.from('join_requests').delete().eq('event_id', partyId).eq('user_id', request.user_id)
    setBusy(null)
    if (error) {
      // The database's own sentence, e.g. `Diese Party ist voll.`; the request stays.
      alertError(
        accept ? 'Die Anfrage konnte nicht angenommen werden.' : 'Die Anfrage konnte nicht abgelehnt werden.',
        error.message
      )
      return
    }
    setRequests((current) => current.filter((item) => item.user_id !== request.user_id))
  }

  if (requests.length === 0) return null

  return (
    <InfoCard icon={UserPlus} color='green' title='Anfragen' wide>
      <ul className='mt-1 flex flex-col'>
        {requests.map((request, i) => (
          <li key={request.user_id}>
            {i > 0 && <div className='h-px w-full bg-divider' />}
            <div className='flex h-12.5 items-center gap-3'>
              <Avatar
                size={30}
                url={request.avatar_url}
                color={request.avatar_color}
                firstname={request.firstname}
                lastname={request.lastname}
              />
              <span className='min-w-0 flex-1 truncate text-text-3 font-bold text-heading'>{fullName(request)}</span>
              <button
                type='button'
                onClick={() => answer(request, true)}
                disabled={busy === request.user_id}
                className={`${pill} bg-green`}
              >
                Annehmen
              </button>
              <button
                type='button'
                onClick={() => answer(request, false)}
                disabled={busy === request.user_id}
                className={`${pill} bg-button-toggle-off`}
              >
                Ablehnen
              </button>
            </div>
          </li>
        ))}
      </ul>
    </InfoCard>
  )
}
