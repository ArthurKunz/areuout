'use client'

import { useEffect, useRef, type ReactNode } from 'react'

// A detail page's scrolling body with its buttons floating above it, as in Find My
// (Redesign Build Order, step 11b): on the way down the buttons leave with the content,
// on the way up they come back wherever the list is, with no bar or blur behind them.
// Written to the DOM on scroll, never through React state, like Sheet. The bar lets
// touches through; its buttons take them back with `pointer-events-auto`.
export default function Headroom({ bar, children }: { bar: ReactNode; children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const scroller = scrollRef.current
    const overlay = barRef.current
    if (!scroller || !overlay) return

    let last = 0
    let offset = 0
    const update = () => {
      // Negative while iOS rubber-bands past the top.
      const top = Math.max(0, scroller.scrollTop)
      // Follows every scrolled pixel, never further than the bar is tall, and never off
      // the top of the list.
      offset = Math.min(Math.max(offset + top - last, 0), overlay.offsetHeight, top)
      last = top
      overlay.style.transform = `translate3d(0, ${-offset}px, 0)`
    }
    scroller.addEventListener('scroll', update, { passive: true })
    return () => scroller.removeEventListener('scroll', update)
  }, [])

  return (
    <div className='relative flex min-h-0 flex-1 flex-col'>
      {/* From the container's top edge (over the Sheet's pt-6), so moving it by its own
          height takes it out of sight entirely. */}
      <div ref={barRef} className='pointer-events-none absolute inset-x-0 -top-6 z-10 px-5 pt-6 will-change-transform'>
        {bar}
      </div>
      {/* Up to the container's top edge as well: cards scroll on under the rounded
          corners instead of being cut 24px below them. */}
      <div ref={scrollRef} className='relative -mt-6 min-h-0 flex-1 overflow-y-auto px-5 pt-6 pb-5'>
        {children}
      </div>
    </div>
  )
}
