'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import StepFrame from '../StepFrame'
import Collapse from '@/components/shared/Collapse'
import ToggleInput from '@/components/shared/ToggleInput'
import PartyDateSheet, { type PartyDate } from '@/features/parties/components/PartyDateSheet'
import PartyTimeSheet, { type PartyTime } from '@/features/parties/components/PartyTimeSheet'
import { canLeaveTime, type PartyDraft } from '../draft'

type Open = 'date' | 'start' | 'end' | null

const pad = (n: number) => String(n).padStart(2, '0')
const formatDate = (d: PartyDate) => `${pad(d.day)}.${pad(d.month + 1)}.${String(d.year).slice(-2)}`
const formatTime = (t: PartyTime) => `${pad(t.hour)}:${pad(t.minute)} Uhr`

// Where each wheel opens while its value is still empty — the same defaults as the old
// create flow: today, 20:00 for the start, 02:00 for the end.
const today = (): PartyDate => {
  const now = new Date()
  return { day: now.getDate(), month: now.getMonth(), year: now.getFullYear() }
}
const DEFAULT_START: PartyTime = { hour: 20, minute: 0 }
const DEFAULT_END: PartyTime = { hour: 2, minute: 0 }

// A row that opens a wheel instead of taking text. Same shape as InputRow; the value
// sits in a read-only input so it renders exactly like a typed one, placeholder colour
// included.
export function PickerRow({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button type='button' onClick={onClick} className='flex h-[50px] w-full items-center gap-3 px-4'>
      <span className='shrink-0 text-text-3 font-semibold text-heading'>{label}</span>
      <input
        type='text'
        readOnly
        tabIndex={-1}
        value={value}
        placeholder='auswählen'
        className='pointer-events-none min-w-0 flex-1 bg-transparent text-right text-text-3 text-text outline-none placeholder:text-input'
      />
    </button>
  )
}

export const cardClass = 'w-full max-w-[350px] rounded-[25px] bg-main backdrop-blur-[100px]'

// Datum, Startzeit and an optional Endzeit with their wheels. The end joins the start's
// card when the switch below is on (mockups Create 02 and 03). Step 2 of Create Party
// and the Edit Party form both show it.
export function TimeFields({ draft, update }: { draft: PartyDraft; update: (patch: Partial<PartyDraft>) => void }) {
  const [open, setOpen] = useState<Open>(null)
  const close = () => setOpen(null)

  // The wheel opens on a default, and that default is what the user sees — so it counts
  // as the answer straight away, as in the old flow.
  const openSheet = (which: Exclude<Open, null>) => {
    if (which === 'date' && !draft.date) update({ date: today() })
    if (which === 'start' && !draft.start) update({ start: DEFAULT_START })
    if (which === 'end' && !draft.end) update({ end: DEFAULT_END })
    setOpen(which)
  }

  // The container carries a transform, which turns `position: fixed` inside it into
  // "fixed to the container". The wheel has to cover the whole screen, so it is
  // rendered at the body instead.
  const sheet =
    open === 'date' ? (
      <PartyDateSheet value={draft.date ?? today()} onChange={(date) => update({ date })} onClose={close} />
    ) : open === 'start' ? (
      <PartyTimeSheet value={draft.start ?? DEFAULT_START} onChange={(start) => update({ start })} onClose={close} />
    ) : open === 'end' ? (
      <PartyTimeSheet value={draft.end ?? DEFAULT_END} onChange={(end) => update({ end })} onClose={close} />
    ) : null

  return (
    <>
      <div className={cardClass}>
        <PickerRow label='Datum' value={draft.date ? formatDate(draft.date) : ''} onClick={() => openSheet('date')} />
      </div>

      <div className={cardClass}>
        <PickerRow label='Startzeit' value={draft.start ? formatTime(draft.start) : ''} onClick={() => openSheet('start')} />
        <Collapse open={draft.endEnabled}>
          <div className='mx-4 h-px rounded-full bg-divider' />
          <PickerRow label='Endzeit' value={draft.end ? formatTime(draft.end) : ''} onClick={() => openSheet('end')} />
        </Collapse>
      </div>

      <ToggleInput label='Endzeit' checked={draft.endEnabled} onChange={(endEnabled) => update({ endEnabled })} />

      {sheet && createPortal(sheet, document.body)}
    </>
  )
}

// Step 2: date, start and an optional end.
export default function TimeStep({
  draft,
  update,
  onNext,
  onBack,
  onClose,
}: {
  draft: PartyDraft
  update: (patch: Partial<PartyDraft>) => void
  onNext: () => void
  onBack: () => void
  onClose: () => void
}) {
  return (
    <StepFrame
      title='Time'
      onClose={onClose}
      onBack={onBack}
      button={{ label: 'Weiter', onClick: onNext, disabled: !canLeaveTime(draft) }}
    >
      <TimeFields draft={draft} update={update} />
    </StepFrame>
  )
}
