'use client'

import { createContext, useContext, useLayoutEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { usePathname } from 'next/navigation'
import Sheet from '@/components/shell/Sheet'
import TabNav, { TABS } from '@/components/shell/TabNav'

const HideContext = createContext<Dispatch<SetStateAction<number>> | null>(null)

// Hides the navigation and the slider together while it is mounted. For states inside
// a tab that are not routes of their own (the party detail replaces the list in the
// same container). Routes need nothing: only the four tab roots show either.
export function HideShell() {
  const setHidden = useContext(HideContext)
  useLayoutEffect(() => {
    if (!setHidden) return
    setHidden((count) => count + 1)
    return () => setHidden((count) => count - 1)
  }, [setHidden])
  return null
}

// The container and the bottom navigation of every screen in app/(shell). Rule from
// the vault (App Redesign 2.1 and 3.3): navigation and slider exist only on Explore,
// My Parties, Hosting and Profile, and always together.
export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [hidden, setHidden] = useState(0)
  // Kept here, above the pages, so it survives tab changes.
  const [open, setOpen] = useState(true)
  const navRef = useRef<HTMLElement>(null)

  const showChrome = hidden === 0 && TABS.some((tab) => tab.href === pathname)

  return (
    <HideContext value={setHidden}>
      {/* Before Sheet on purpose: React attaches refs in tree order, and Sheet measures
          the bar in its layout effect. Stacking comes from z-index, not from order. */}
      {showChrome && <TabNav ref={navRef} pathname={pathname} onSelect={() => setOpen(true)} />}
      <Sheet open={open || !showChrome} onOpenChange={setOpen} draggable={showChrome} navRef={navRef}>
        {children}
      </Sheet>
    </HideContext>
  )
}
