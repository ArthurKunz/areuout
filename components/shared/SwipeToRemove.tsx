'use client'

import { useRef, useState, type PointerEvent, type ReactNode } from 'react'

// How far the row slides open, which is also the width of the Entfernen button.
const REVEAL = 112
// Movement below this is still a tap.
const SLOP = 6
// Apple's momentum projection, as in Sheet.tsx: where a flick would come to rest, so a
// short fast swipe still opens or closes the row.
const DECELERATION = 0.998
const project = (pxPerSecond: number) => ((pxPerSecond / 1000) * DECELERATION) / (1 - DECELERATION)
const VELOCITY_WINDOW_MS = 100

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
  // The last moves, for the velocity at release.
  const samples = useRef<{ x: number; t: number }[]>([])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    start.current = { x: event.clientX, y: event.clientY, offset, moved: false }
    samples.current = [{ x: event.clientX, t: event.timeStamp }]
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
    samples.current.push({ x: event.clientX, t: event.timeStamp })
    while (samples.current.length > 2 && event.timeStamp - samples.current[0].t > VELOCITY_WINDOW_MS) samples.current.shift()
  }

  // Open or closed, by where the release would carry the row rather than where it is.
  const settle = (current: number) => {
    const first = samples.current[0]
    const last = samples.current[samples.current.length - 1]
    const elapsed = last.t - first.t
    const pxPerSecond = elapsed > 0 ? ((last.x - first.x) / elapsed) * 1000 : 0
    return current + project(pxPerSecond) < -REVEAL / 2 ? -REVEAL : 0
  }

  const onPointerUp = () => {
    const s = start.current
    start.current = null
    if (!s) return
    if (s.moved) {
      setDragging(false)
      setOffset(settle(offset))
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
  const motion = dragging ? '' : 'transition-[transform,width] duration-(--duration-move) ease-ios'

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
