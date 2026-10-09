'use client'

import { useEffect, useState } from 'react'

// Reveal by HEIGHT, via the `grid-rows-[0fr]` → `[1fr]` idiom already used by
// Section, PartyDescription and WheelSheet. It is the only kind of reveal that
// survives a `backdrop-blur` in the subtree: animating opacity or transform would
// make this element the blurred child's backdrop root and leave the card flat and
// unblurred for the animation's full duration. It also reaches the content's
// natural height without measuring it.
//
// A collapsed box is still a flex/grid ITEM, so a `gap` on the parent goes on
// rendering around it — put the spacing inside `children` instead, where it folds
// away with everything else.
export default function Collapse({
  open,
  appear = false,
  className = '',
  children,
}: {
  open: boolean
  /** Unfold on mount instead of being open from the first frame — there has to be
   *  a state to animate FROM, so the flag flips on the frame after mounting. */
  appear?: boolean
  className?: string
  children: React.ReactNode
}) {
  const [entered, setEntered] = useState(!appear)

  useEffect(() => {
    if (entered) return
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [entered])

  return (
    <div
      className={`grid transition-[grid-template-rows] duration-(--duration-move) ease-ios ${
        open && entered ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      } ${className}`}
    >
      <div className='overflow-hidden'>{children}</div>
    </div>
  )
}
