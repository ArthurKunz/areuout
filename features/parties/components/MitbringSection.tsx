'use client'

import { useState } from 'react'
import { alertError } from '@/lib/utils'
import type { Profile } from '@/features/profile/services/profile.service'
import { claimMitbringItem, releaseMitbringItem } from '../services/mitbring.service'
import Avatar from '@/components/shared/Avatar'
import type { MitbringClaim, MitbringItem } from '../types/parties.types'

type Props = {
  items: MitbringItem[]
  userId: string
  isHost: boolean
  myProfile: Profile | null
  onRefresh: () => void
}

// Eine Komponente fuer die ganze Liste, nicht eine je Zeile — und das mit Absicht:
// 'hoechstens eine Beanspruchung pro Person und Party' ist eine Regel ueber die
// Liste. Solange ich etwas halte, muss 'Beanspruchen' auf jeder anderen Zeile
// gesperrt sein, und das weiss nur die Liste.
export default function MitbringSection({ items, userId, isHost, myProfile, onRefresh }: Props) {
  // Was ich gerade selbst geaendert habe, bevor der Server es bestaetigt hat. Der
  // Schluessel ist die Id des Gegenstands, der Wert die Beanspruchung oder null.
  const [pending, setPending] = useState<Record<string, MitbringClaim | null>>({})
  const [submitting, setSubmitting] = useState(false)

  // Sobald frische Daten ankommen, gilt der Server und die Vormerkungen fallen weg.
  // Ohne das ueberdeckte eine alte Vormerkung spaeter die Beanspruchung eines anderen
  // Gastes: wer einen Gegenstand losgelassen hat, saehe ihn weiter als frei, auch
  // nachdem ihn jemand anderes genommen hat.
  //
  // Beim Rendern angepasst, nicht in einem Effect — ein setState im Effect zieht eine
  // zweite Renderrunde nach sich, und genau davor warnt auch der Linter. `items` ist
  // ein neues Array bei jedem Nachladen und sonst dasselbe, taugt also als Signal.
  const [seenItems, setSeenItems] = useState(items)
  if (items !== seenItems) {
    setSeenItems(items)
    setPending({})
  }

  const claimOf = (item: MitbringItem) => (item.id in pending ? pending[item.id] : item.claim)
  const mine = items.find((item) => claimOf(item)?.claimed_by === userId) ?? null

  const myClaim = (itemId: string): MitbringClaim => ({
    item_id: itemId,
    claimed_by: userId,
    firstname: myProfile?.firstname ?? null,
    lastname: myProfile?.lastname ?? null,
    avatar_url: myProfile?.avatar_url ?? null,
    avatar_color: myProfile?.avatar_color ?? null,
  })

  const write = async (
    itemId: string,
    optimistic: MitbringClaim | null,
    run: () => Promise<{ error: { message: string } | null }>
  ) => {
    if (submitting) return
    setPending((prev) => ({ ...prev, [itemId]: optimistic }))
    setSubmitting(true)
    const { error } = await run()
    setSubmitting(false)
    if (error) {
      // Zurueck auf den Stand des Servers, nicht auf den vorherigen Zwischenstand.
      setPending((prev) => {
        const next = { ...prev }
        delete next[itemId]
        return next
      })
      alertError('Deine Beanspruchung konnte nicht gespeichert werden.', error.message)
      return
    }
    onRefresh()
  }

  return (
    <div className='flex flex-col gap-2'>
      {items.map((item) => {
        const claim = claimOf(item)
        const isMine = claim?.claimed_by === userId

        return (
          <div
            key={item.id}
            className={`flex h-12.5 items-center gap-3 rounded-full pl-4 pr-1.5 ${
              claim ? 'bg-tertiary backdrop-blur-xl' : 'bg-secondary'
            }`}
          >
            <span className='truncate text-label-1 text-heading'>{item.label}</span>

            <div className='ml-auto flex shrink-0 items-center gap-2'>
              {claim && (
                <div className='flex items-center gap-2'>
                  <Avatar
                    size={24}
                    url={claim.avatar_url}
                    color={claim.avatar_color}
                    firstname={claim.firstname}
                    lastname={claim.lastname}
                  />
                  <span className='text-label-2 text-label-small'>
                    {isMine ? 'du' : claim.firstname}
                  </span>
                </div>
              )}

              {/* Loslassen darf man das Eigene — und der Gastgeber jedes, als
                  Moderation fuer den Gast, der sich nicht mehr meldet. */}
              {claim && (isMine || isHost) ? (
                <button
                  type='button'
                  onClick={() => void write(item.id, null, () => releaseMitbringItem(item.id))}
                  disabled={submitting}
                  className='h-9 shrink-0 rounded-full bg-quaternary px-3 text-label-2 text-heading transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95 disabled:opacity-50'
                >
                  Loslassen
                </button>
              ) : !claim ? (
                <button
                  type='button'
                  onClick={() =>
                    void write(item.id, myClaim(item.id), () =>
                      claimMitbringItem(item.id, item.event_id, userId)
                    )
                  }
                  // Gesperrt, solange ich schon etwas halte: eine Beanspruchung pro
                  // Person und Party. Die Datenbank weist es ohnehin ab, der Knopf
                  // sagt es nur vorher.
                  disabled={mine !== null || submitting}
                  className='h-9 shrink-0 rounded-full bg-sheet px-3 text-label-2 font-semibold text-sheet-heading transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95 disabled:bg-sheet/40 disabled:text-sheet-heading/60'
                >
                  Beanspruchen
                </button>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
