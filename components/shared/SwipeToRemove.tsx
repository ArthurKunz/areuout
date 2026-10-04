'use client'

import { useRef, useState, type PointerEvent, type ReactNode } from 'react'

// How far the row slides open, which is also the width of the Entfernen button.
const REVEAL = 112
// Movement below this is still a tap.
const SLOP = 6

// A row that slides left to reveal a red Entfernen button behind it, the way iOS lists
// remove an entry (also meant for the guest list, App Redesign 3.6). A tap on the
// closed row calls onTap; a tap on the open row only closes it again. Only horizontal
// drags are taken: touch-action pan-y leaves vertical scrolling of the step to the
// browser.
export default function SwipeToRemove({
  onTap,
  onRemove,
  children,
}: {
  onTap: () => void
  onRemove: () => void
  children: ReactNode
}) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; offset: number; moved: boolean } | null>(null)

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    start.current = { x: event.clientX, y: event.clientY, offset, moved: false }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const s = start.current
    if (!s) return
    const dx = event.clientX - s.x
    const dy = event.clientY - s.y
    if (!s.moved) {
      if (Math.abs(dx) < SLOP || Math.abs(dx) < Math.abs(dy)) return
      s.moved = true
      setDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    setOffset(Math.min(0, Math.max(-REVEAL, s.offset + dx)))
  }

  const onPointerUp = () => {
    const s = start.current
    start.current = null
    if (!s) return
    if (s.moved) {
      setDragging(false)
      setOffset((current) => (current < -REVEAL / 2 ? -REVEAL : 0))
    } else if (offset !== 0) {
      setOffset(0)
    } else {
      onTap()
    }
  }

  const onPointerCancel = () => {
    start.current = null
    setDragging(false)
    setOffset((current) => (current < -REVEAL / 2 ? -REVEAL : 0))
  }

  // Follows the finger directly while dragging, settles with the shell's easing after.
  const motion = dragging ? '' : 'transition-[transform,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]'

  return (
    <div className='relative w-full max-w-[350px] overflow-hidden rounded-[25px]'>
      {/* Grows from the right edge only as far as the row has moved: the rows are
          translucent, so a full-width button behind them would shine through. */}
      <button
        type='button'
        onClick={onRemove}
        tabIndex={offset === 0 ? -1 : 0}
        style={{ width: -offset }}
        className={`absolute inset-y-0 right-0 flex items-center justify-center overflow-hidden whitespace-nowrap rounded-[25px] bg-red text-text-3 font-semibold text-main-white ${motion}`}
      >
        Entfernen
      </button>
      <div
        role='button'
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onTap()
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{ transform: `translate3d(${offset}px, 0, 0)` }}
        className={`relative touch-pan-y select-none ${motion}`}
      >
        {children}
      </div>
    </div>
  )
}
