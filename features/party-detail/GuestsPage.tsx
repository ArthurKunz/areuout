'use client'

import { useEffect, useState } from 'react'
import { Check, CircleQuestionMark, Users, X } from 'lucide-react'
import Avatar from '@/components/shared/Avatar'
import SearchInput from '@/components/shared/SearchInput'
import SwipeToRemove from '@/components/shared/SwipeToRemove'
import { deleteRsvp } from '@/features/parties/services/parties.service'
import type { RsvpStatus } from '@/features/parties/types/parties.types'
import { supabase } from '@/lib/supabase/client'
import { alertError } from '@/lib/utils'
import ConfirmPrompt from './ConfirmPrompt'
import { InfoCard } from './DetailCards'
import type { ProfileUser } from './ProfilePage'

type Guest = { user_id: string; firstname: string; lastname: string; avatar_url: string; avatar_color: string; status: string }

const STATUS_ICON = { going: Check, maybe: CircleQuestionMark, not_going: X } as const

const fullName = (guest: Guest) => [guest.firstname, guest.lastname].filter(Boolean).join(' ') || 'Unbekannt'

const toUser = (guest: Guest): ProfileUser => ({
  id: guest.user_id,
  firstname: guest.firstname,
  lastname: guest.lastname,
  avatarUrl: guest.avatar_url,
  avatarColor: guest.avatar_color,
})

// The body of page `Teilnehmer` (App Redesign 3.6, mockup My Parties 07): four tiles
// with the counts, a search by name, then one card with everyone. get_party_guest_list
// answers every viewer, a stranger included, with full names, pictures and answers only.
// The host is listed as `Gastgeber`, never as an answer, and is not counted. Only the
// host can swipe a guest away; RLS (rsvps_delete_host) is what actually allows it. The
// removed guest can come back through the invite link.
export default function GuestsPage({
  partyId,
  maxGuests,
  userId,
  myStatus,
  canRemove,
  onProfile,
}: {
  partyId: string
  maxGuests: number | null
  userId: string | null
  // The viewer's own answer as the RSVP button shows it, so the own row follows it.
  myStatus: RsvpStatus | null
  canRemove: boolean
  onProfile: (user: ProfileUser) => void
}) {
  const [guests, setGuests] = useState<Guest[] | null>(null)
  const [confirm, setConfirm] = useState<Guest | null>(null)
  const [removing, setRemoving] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_party_guest_list', { p_event_id: partyId }).then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        alertError('Die Gästeliste konnte nicht geladen werden.', error.message)
        setGuests([])
        return
      }
      setGuests(data)
    })
    return () => {
      cancelled = true
    }
  }, [partyId])

  const remove = async () => {
    if (!confirm) return
    setRemoving(true)
    const { error } = await deleteRsvp(partyId, confirm.user_id)
    setRemoving(false)
    if (error) {
      alertError('Der Gast konnte nicht entfernt werden.', error.message)
      return
    }
    setGuests((current) => current?.filter((guest) => guest.user_id !== confirm.user_id) ?? null)
    setConfirm(null)
  }

  if (!guests) {
    return (
      <div className='grid grid-cols-2 gap-2.5'>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className='h-28 rounded-[25px] skeleton' />
        ))}
        <div className='col-span-2 h-40 rounded-[25px] skeleton' />
      </div>
    )
  }

  const rows = guests.map((guest) => (guest.user_id === userId && myStatus ? { ...guest, status: myStatus } : guest))
  const count = (status: RsvpStatus) => rows.filter((guest) => guest.status === status).length
  // The search narrows the card only; the tiles keep counting the whole party.
  const needle = query.trim().toLowerCase()
  const shown = rows.filter((guest) => fullName(guest).toLowerCase().includes(needle))

  return (
    <div className='grid grid-cols-2 gap-2.5'>
      <InfoCard icon={Check} color='green' title='Teilnehmer' value={String(count('going'))} />
      {maxGuests !== null && <InfoCard icon={Users} color='blue' title='Max. Teilnehmer' value={`max. ${maxGuests}`} />}
      <InfoCard icon={CircleQuestionMark} color='yellow' title='Vielleicht' value={String(count('maybe'))} />
      <InfoCard icon={X} color='red' title='Abgesagt' value={String(count('not_going'))} />

      <div className='col-span-2'>
        <SearchInput value={query} onChange={setQuery} placeholder='Suchen' />
      </div>

      {shown.length === 0 ? (
        <span className='col-span-2 pt-2 text-center text-text-2 text-text'>Keine Teilnehmer gefunden</span>
      ) : (
        <ul className='col-span-2 flex flex-col rounded-[25px] bg-main px-4 py-1'>
          {shown.map((guest, i) => {
            const Icon = STATUS_ICON[guest.status as RsvpStatus] as (typeof STATUS_ICON)[RsvpStatus] | undefined
            const person = (
              <>
                <Avatar size={30} url={guest.avatar_url} color={guest.avatar_color} firstname={guest.firstname} lastname={guest.lastname} />
                <span className='min-w-0 flex-1 truncate text-text-3 font-bold text-heading'>{fullName(guest)}</span>
              </>
            )
            // A swipeable row opens the profile through its own tap instead: a button
            // inside it would answer the same tap a second time.
            const swipeable = canRemove && guest.status !== 'host'
            const row = (
              <div className='flex h-12.5 items-center gap-3'>
                {swipeable || guest.user_id === userId ? (
                  person
                ) : (
                  <button type='button' onClick={() => onProfile(toUser(guest))} className='flex min-w-0 flex-1 items-center gap-3 text-left'>
                    {person}
                  </button>
                )}
                {guest.status === 'host' ? (
                  <span className='shrink-0 text-text-3 text-text'>Gastgeber</span>
                ) : (
                  Icon && <Icon size={20} className='shrink-0 text-heading' />
                )}
              </div>
            )
            return (
              <li key={guest.user_id}>
                {i > 0 && <div className='h-px w-full bg-divider' />}
                {swipeable ? (
                  <SwipeToRemove onTap={() => onProfile(toUser(guest))} onRemove={() => setConfirm(guest)}>
                    {row}
                  </SwipeToRemove>
                ) : (
                  row
                )}
              </li>
            )
          })}
        </ul>
      )}

      {confirm && (
        <ConfirmPrompt
          title={`${fullName(confirm)} aus der Party entfernen?`}
          message='Der Einladungslink funktioniert weiter — die Person könnte erneut zusagen.'
          confirmLabel='Entfernen'
          pending={removing}
          onConfirm={remove}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
