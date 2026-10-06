'use client'

// TEMPORARY (step 11b): live numbers for the green bar on iOS Safari, shown only with
// ?debug=1 in the URL. Delete this file, its use in app/(shell)/layout.tsx and the
// noteRunwayCorrection() call in ShellMap once the bug is found.

import { useEffect, useRef, useSyncExternalStore } from 'react'

let corrections = 0

// Called by ShellMap's scroll guard each time it has to put the page back.
export function noteRunwayCorrection() {
  corrections += 1
}

const noSubscription = () => () => {}

// Local time with milliseconds, to line up with the phone's clock.
const time = (stamp: number | null) =>
  stamp === null ? '–' : `${new Date(stamp).toLocaleTimeString('de-DE')}.${String(stamp % 1000).padStart(3, '0')}`

export default function MapDebug() {
  // Off on the server and in the first client render, so hydration matches.
  const enabled = useSyncExternalStore(
    noSubscription,
    () => new URLSearchParams(window.location.search).get('debug') === '1',
    () => false
  )
  const textRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    if (!enabled) return
    const last: Record<'scroll' | 'resize' | 'vvResize' | 'pageshow', number | null> = {
      scroll: null,
      resize: null,
      vvResize: null,
      pageshow: null,
    }
    const onScroll = () => (last.scroll = Date.now())
    const onResize = () => (last.resize = Date.now())
    const onVvResize = () => (last.vvResize = Date.now())
    const onPageshow = () => (last.pageshow = Date.now())
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onVvResize)
    window.addEventListener('pageshow', onPageshow)

    let frame = 0
    const draw = () => {
      const wrapper = document.querySelector('[data-runway]')?.getBoundingClientRect()
      const vv = window.visualViewport
      if (textRef.current) {
        textRef.current.textContent = [
          `scrollY ${window.scrollY.toFixed(1)}`,
          `innerH ${window.innerHeight}  vvH ${vv ? vv.height.toFixed(1) : '–'}  vvTop ${vv ? vv.offsetTop.toFixed(1) : '–'}`,
          `map ${wrapper ? `${wrapper.top.toFixed(1)} → ${wrapper.bottom.toFixed(1)}` : '–'}`,
          `docH ${document.documentElement.scrollHeight}`,
          `fixes ${corrections}`,
          `scroll ${time(last.scroll)}`,
          `resize ${time(last.resize)}`,
          `vvResize ${time(last.vvResize)}`,
          `pageshow ${time(last.pageshow)}`,
        ].join('\n')
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onVvResize)
      window.removeEventListener('pageshow', onPageshow)
    }
  }, [enabled])

  if (!enabled) return null
  // Top left and narrow: Safari tints its bars from fixed layers at the centre of an
  // edge, so this must not reach the middle. 60px down so the status bar cannot cover
  // the first line.
  return (
    <pre
      ref={textRef}
      className='pointer-events-none fixed top-15 left-0 z-[9999] max-w-[45vw] bg-main p-1 font-mono text-hint-1 leading-tight text-main-white'
    />
  )
}
