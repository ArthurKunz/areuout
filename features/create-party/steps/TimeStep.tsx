'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import StepFrame from '../StepFrame'
import Collapse from '@/components/shared/Collapse'
import WarningBanner from '@/components/shared/WarningBanner'
import ToggleInput from '@/components/shared/ToggleInput'
import PartyDateSheet, { type PartyDate } from '@/features/parties/components/PartyDateSheet'
import PartyTimeSheet, { type PartyTime } from '@/features/parties/components/PartyTimeSheet'
import { canLeaveTime, endProblem, type PartyDraft } from '../draft'

type Open = 'date' | 'endDate' | 'start' | 'end' | null

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

const nextDay = (d: PartyDate): PartyDate => {
  const date = new Date(d.year, d.month, d.day + 1)
  return { day: date.getDate(), month: date.getMonth(), year: date.getFullYear() }
}
const minutes = (t: PartyTime) => t.hour * 60 + t.minute

// A row that opens a wheel instead of taking text. Same shape as InputRow; the value
// sits in a read-only input so it renders exactly like a typed one, placeholder colour
// included.
export function PickerRow({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button type='button' onClick={onClick} className='flex h-[50px] w-full items-center gap-3 px-4 transition-colors duration-(--duration-press) ease-ios active:bg-selector'>
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

export const cardClass = 'w-full max-w-[350px] overflow-hidden rounded-[25px] bg-main glass-field'

// Startdatum and Startzeit with their wheels, and an optional end that has its own date
// as well as its own time. Each end row joins its start's card when the switch below is
// on (mockups Create 02, 03 and 18). Step 2 of Create Party and the Edit Party form both
// show it.
export function TimeFields({ draft, update }: { draft: PartyDraft; update: (patch: Partial<PartyDraft>) => void }) {
  const [open, setOpen] = useState<Open>(null)
  const close = () => setOpen(null)
  const problem = endProblem(draft)

  // The wheel opens on a default, and that default is what the user sees — so it counts
  // as the answer straight away, as in the old flow.
  const openSheet = (which: Exclude<Open, null>) => {
    if (which === 'date' && !draft.date) update({ date: today() })
    if (which === 'endDate' && !draft.endDate) update({ endDate: draft.date ?? today() })
    if (which === 'start' && !draft.start) update({ start: DEFAULT_START })
    if (which === 'end' && !draft.end) update({ end: DEFAULT_END })
    setOpen(which)
  }

  // Switching the end on fills both of its rows at once, so the card never opens on an
  // error the host did not cause. The date is the start's -- except when the end time
  // would land at or before the start, the ordinary party past midnight, which gets the
  // next day. That is what the flow did implicitly before the end had a date of its own.
  const toggleEnd = (endEnabled: boolean) => {
    if (!endEnabled) return update({ endEnabled })
    const end = draft.end ?? DEFAULT_END
    const date = draft.date ?? today()
    update({
      endEnabled,
      end,
      endDate: draft.endDate ?? (draft.start && minutes(end) <= minutes(draft.start) ? nextDay(date) : date),
    })
  }

  // The container carries a transform, which turns `position: fixed` inside it into
  // "fixed to the container". The wheel has to cover the whole screen, so it is
  // rendered at the body instead.
  const sheet =
    open === 'date' ? (
      <PartyDateSheet value={draft.date ?? today()} onChange={(date) => update({ date })} onClose={close} />
    ) : open === 'endDate' ? (
      <PartyDateSheet
        value={draft.endDate ?? draft.date ?? today()}
        onChange={(endDate) => update({ endDate })}
        onClose={close}
      />
    ) : open === 'start' ? (
      <PartyTimeSheet value={draft.start ?? DEFAULT_START} onChange={(start) => update({ start })} onClose={close} />
    ) : open === 'end' ? (
      <PartyTimeSheet value={draft.end ?? DEFAULT_END} onChange={(end) => update({ end })} onClose={close} />
    ) : null

  return (
    <>
      <div className={cardClass}>
        <PickerRow label='Startdatum' value={draft.date ? formatDate(draft.date) : ''} onClick={() => openSheet('date')} />
        <Collapse open={draft.endEnabled}>
          <div className='mx-4 h-px rounded-full bg-divider' />
          <PickerRow
            label='Enddatum'
            value={draft.endDate ? formatDate(draft.endDate) : ''}
            onClick={() => openSheet('endDate')}
          />
        </Collapse>
      </div>

      <div className={cardClass}>
        <PickerRow label='Startzeit' value={draft.start ? formatTime(draft.start) : ''} onClick={() => openSheet('start')} />
        <Collapse open={draft.endEnabled}>
          <div className='mx-4 h-px rounded-full bg-divider' />
          <PickerRow label='Endzeit' value={draft.end ? formatTime(draft.end) : ''} onClick={() => openSheet('end')} />
        </Collapse>
      </div>

      <ToggleInput label='Endzeit' checked={draft.endEnabled} onChange={toggleEnd} />

      {problem && <WarningBanner message={problem} />}

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
