'use client'

import { useRef, useState, type TouchEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { cardClass, RowDivider, rowClass, rowLabelClass, rowValueClass } from '@/components/shared/Card'
import type { QuestionDraft } from '../types/parties.types'

const ACTION_WIDTH = 80
const GAP = 12
const SLIDE = ACTION_WIDTH + GAP
const OPEN_AT = SLIDE / 2
const SLOP = 8

// Eine entworfene Frage als Uebersichtszeile. Antippen oeffnet das Formular darauf,
// nach links wischen legt den Loeschen-Knopf frei — wie eine iOS-Listenzeile, und
// wie PoolDraftCard, von dem die Geste hier uebernommen ist. Die beiden Karten
// zeigen Verschiedenes: eine Umfrage ihre Optionen, eine Frage ihre Beschreibung.
export default function QuestionDraftCard({
  question,
  deleting = false,
  onEdit,
  onDelete,
}: {
  question: QuestionDraft
  /** Gehoert dem Aufrufer, der weiss, dass geloescht werden darf: die Karte fuehrt
   *  den Wisch zu Ende und geht nach links, waehrend ihr Platz zusammenfaellt. */
  deleting?: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef({ x: 0, y: 0, offset: 0 })
  // Bei der ersten echten Bewegung festgelegt: ein senkrechter Zug bleibt Scrollen.
  const axis = useRef<'none' | 'x' | 'y'>('none')

  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0]
    start.current = { x: touch.clientX, y: touch.clientY, offset }
    axis.current = 'none'
    setDragging(true)
  }

  const handleTouchMove = (e: TouchEvent) => {
    const touch = e.touches[0]
    const dx = touch.clientX - start.current.x
    const dy = touch.clientY - start.current.y
    if (axis.current === 'none') {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (axis.current !== 'x') return
    setOffset(Math.min(0, Math.max(-SLIDE, start.current.offset + dx)))
  }

  const handleTouchEnd = () => {
    setDragging(false)
    setOffset(offset < -OPEN_AT ? -SLIDE : 0)
  }

  const handleClick = () => {
    // Der Klick am Ende eines Wischs darf das Formular nicht oeffnen, und solange der
    // Loeschen-Knopf draussen ist, raeumt die ganze Zeile ihn wieder weg.
    if (axis.current === 'x') return
    if (offset !== 0) {
      setOffset(0)
      return
    }
    onEdit()
  }

  return (
    <div className='overflow-hidden'>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: deleting ? 'translateX(-100%)' : `translateX(${offset}px)` }}
        className={`flex items-stretch gap-3 ${
          dragging && !deleting ? '' : 'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]'
        }`}
      >
        <button type='button' onClick={handleClick} className={`${cardClass} shrink-0 text-left`}>
          <div className={rowClass}>
            <span className={rowLabelClass}>Frage</span>
            <span className={`ml-auto truncate ${rowValueClass}`}>{question.question}</span>
          </div>
          {question.description && (
            <>
              <RowDivider />
              <div className={rowClass}>
                <span className={rowLabelClass}>Details</span>
                <span className={`ml-auto truncate ${rowValueClass}`}>{question.description}</span>
              </div>
            </>
          )}
        </button>

        {/* Neben der Karte, nicht darunter: die Karte ist durchscheinend, ein Knopf
            dahinter waere durch sie hindurch zu sehen. */}
        <button
          type='button'
          onClick={onDelete}
          aria-label='Frage löschen'
          className='flex w-20 shrink-0 items-center justify-center'
        >
          <Trash2 size={22} strokeWidth={2.5} className='text-warning' />
        </button>
      </div>
    </div>
  )
}
