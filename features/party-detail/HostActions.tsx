'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Ellipsis, Link, Pencil, Share, Trash2 } from 'lucide-react'
import IconButton from '@/components/shared/IconButton'
import { deleteParty, updateParty } from '@/features/parties/services/parties.service'
import { alertError, generateInviteCode, getOrigin, shareInvite } from '@/lib/utils'
import ConfirmPrompt from './ConfirmPrompt'

type Confirm = 'reset' | 'delete' | null

const menuItem = 'flex h-11 w-full items-center gap-3 px-4 text-text-1'

// The host's buttons in the detail header (App Redesign 6.3): ⋯ with Link-reset,
// bearbeiten and löschen, then share. Reset and delete reuse the old screen's logic and
// texts; only the dialog is the redesign's.
export default function HostActions({
  partyId,
  hostId,
  title,
  inviteCode,
  onInviteCode,
  onDeleted,
}: {
  partyId: string
  hostId: string
  title: string
  inviteCode: string
  onInviteCode: (code: string) => void
  onDeleted: () => void
}) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [pending, setPending] = useState(false)
  const [shared, setShared] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // A tap anywhere outside the menu closes it.
  useEffect(() => {
    if (!menuOpen) return
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [menuOpen])

  const share = async () => {
    if (!(await shareInvite(title, `${getOrigin()}/e/${inviteCode}`))) return
    setShared(true)
    setTimeout(() => setShared(false), 2000)
  }

  // The code is the secret, not the party id: replacing it is what takes access away
  // from a leaked link. Generated here as on create; RLS, the CHECK and the UNIQUE on
  // invite_code decide what may go in.
  const resetLink = async () => {
    setPending(true)
    const code = generateInviteCode()
    const { error } = await updateParty(partyId, { invite_code: code })
    setPending(false)
    if (error) {
      alertError('Der Link konnte nicht zurückgesetzt werden.', error.message)
      return
    }
    // Share hands out the new link straight away.
    onInviteCode(code)
    setConfirm(null)
  }

  // Polls, options, questions and their answers go with the row by cascade;
  // deleteParty then removes the picture folder in Storage.
  const remove = async () => {
    setPending(true)
    const { error } = await deleteParty(partyId, hostId)
    if (error) {
      setPending(false)
      alertError('Party konnte nicht gelöscht werden.', error.message)
      return
    }
    onDeleted()
  }

  const pick = (action: () => void) => () => {
    setMenuOpen(false)
    action()
  }

  return (
    <>
      <div ref={menuRef} className='relative'>
        <IconButton icon={Ellipsis} label='Mehr' onClick={() => setMenuOpen((open) => !open)} />
        {/* Grows out of the ⋯ above its right edge. */}
        <div
          role='menu'
          data-open={menuOpen || undefined}
          className='pop absolute top-full right-0 z-20 mt-2 w-max origin-top-right overflow-hidden rounded-[20px] bg-main py-1 glass-overlay'
        >
          <button type='button' role='menuitem' onClick={pick(() => setConfirm('reset'))} className={`${menuItem} text-heading`}>
            <Link size={22} />
            Link-reset
          </button>
          <div className='mx-4 h-px rounded-full bg-divider' />
          <button
            type='button'
            role='menuitem'
            onClick={pick(() => router.push(`/hosting/${partyId}/edit`))}
            className={`${menuItem} text-heading`}
          >
            <Pencil size={22} />
            bearbeiten
          </button>
          <div className='mx-4 h-px rounded-full bg-divider' />
          <button type='button' role='menuitem' onClick={pick(() => setConfirm('delete'))} className={`${menuItem} text-red`}>
            <Trash2 size={22} />
            löschen
          </button>
        </div>
      </div>
      {/* The tick grows in as the answer to the tap; the arrow comes back quietly. */}
      <IconButton icon={shared ? Check : Share} iconClassName={shared ? 'icon-in' : undefined} label='Teilen' onClick={share} />

      {/* Both stay rendered, each with its own text, so the one closing keeps its words
          while it fades. */}
      <ConfirmPrompt
        open={confirm === 'reset'}
        title='Link wirklich zurücksetzen?'
        message='Der alte Link funktioniert danach nicht mehr. Wer ihn schon hat, kommt nicht mehr rein.'
        confirmLabel='Zurücksetzen'
        pending={pending}
        onConfirm={resetLink}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmPrompt
        open={confirm === 'delete'}
        title='Party wirklich löschen?'
        message='Das kann nicht rückgängig gemacht werden.'
        confirmLabel='löschen'
        pending={pending}
        onConfirm={remove}
        onCancel={() => setConfirm(null)}
      />
    </>
  )
}
