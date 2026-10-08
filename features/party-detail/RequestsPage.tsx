'use client'

import { useEffect, useState } from 'react'
import { Check, UserPlus, X } from 'lucide-react'
import Avatar from '@/components/shared/Avatar'
import SearchInput from '@/components/shared/SearchInput'
import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'
import { alertError } from '@/lib/utils'
import { InfoCard } from './DetailCards'
import type { ProfileUser } from './ProfilePage'

export type JoinRequest = Database['public']['Functions']['get_party_join_requests']['Returns'][number]

const fullName = (request: JoinRequest) => [request.firstname, request.lastname].filter(Boolean).join(' ') || 'Unbekannt'

// A 44px tap area around a 30px circle: the circle is what shows, the box is what the
// finger hits.
const tap = 'flex size-11 shrink-0 items-center justify-center transition-opacity duration-200 disabled:opacity-40'
const circle = 'flex size-[30px] items-center justify-center rounded-full text-main-white glass-control'

// The host's page `Anfragen` (App Redesign 6.3, mockup Hosting 10): two tiles with the
// counts, a search by name, then one row per person who asked, oldest first as
// get_party_join_requests returns them, built like the guest list's rows. The green ✓
// runs accept_join_request, which sets the person to zugesagt; the red ✗ deletes the
// request through join_requests_delete_host, and the person may ask again. Either way
// the row goes, and the detail hears of it so its card counts the same.
export default function RequestsPage({
  partyId,
  requests,
  onAnswered,
  onProfile,
}: {
  partyId: string
  requests: JoinRequest[]
  onAnswered: (userId: string) => void
  onProfile: (user: ProfileUser) => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  // Zugesagt, from the same list the page `Teilnehmer` counts.
  const [going, setGoing] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_party_guest_list', { p_event_id: partyId }).then(({ data }) => {
      if (cancelled) return
      setGoing((data ?? []).filter((guest) => guest.status === 'going').length)
    })
    return () => {
      cancelled = true
    }
  }, [partyId])

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
    if (accept) setGoing((current) => (current === null ? current : current + 1))
    onAnswered(request.user_id)
  }

  const needle = query.trim().toLowerCase()
  const shown = requests.filter((request) => fullName(request).toLowerCase().includes(needle))

  return (
    <div className='grid grid-cols-2 gap-2.5'>
      <InfoCard icon={UserPlus} color='lime' title='Anfragen' value={String(requests.length)} />
      <InfoCard
        icon={Check}
        color='green'
        title='Teilnehmer'
        value={going === null ? <span className='inline-block h-3.5 w-6 rounded-full skeleton' /> : String(going)}
      />

      <div className='col-span-2'>
        <SearchInput value={query} onChange={setQuery} placeholder='Suchen' />
      </div>

      {shown.length === 0 ? (
        <span className='col-span-2 pt-2 text-center text-text-2 text-text'>Keine Anfragen gefunden</span>
      ) : (
        <ul className='col-span-2 flex flex-col rounded-[25px] bg-main px-4 py-1'>
          {shown.map((request, i) => (
            <li key={request.user_id}>
              {i > 0 && <div className='h-px w-full bg-divider' />}
              <div className='flex h-12.5 items-center gap-3'>
                <button
                  type='button'
                  onClick={() =>
                    onProfile({
                      id: request.user_id,
                      firstname: request.firstname,
                      lastname: request.lastname,
                      avatarUrl: request.avatar_url,
                      avatarColor: request.avatar_color,
                    })
                  }
                  className='flex min-w-0 flex-1 items-center gap-3 text-left'
                >
                  <Avatar
                    size={30}
                    url={request.avatar_url}
                    color={request.avatar_color}
                    firstname={request.firstname}
                    lastname={request.lastname}
                  />
                  <span className='min-w-0 flex-1 truncate text-text-3 font-bold text-heading'>{fullName(request)}</span>
                </button>
                {/* The ✗'s circle ends at the row's edge; its tap box reaches 7px past it. */}
                <div className='-mr-[7px] flex shrink-0'>
                  <button
                    type='button'
                    aria-label='Annehmen'
                    onClick={() => answer(request, true)}
                    disabled={busy === request.user_id}
                    className={tap}
                  >
                    <span className={`${circle} bg-green`}>
                      <Check size={18} strokeWidth={3} />
                    </span>
                  </button>
                  <button
                    type='button'
                    aria-label='Ablehnen'
                    onClick={() => answer(request, false)}
                    disabled={busy === request.user_id}
                    className={tap}
                  >
                    <span className={`${circle} bg-red`}>
                      <X size={18} strokeWidth={3} />
                    </span>
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
