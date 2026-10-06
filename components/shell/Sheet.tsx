'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, type PointerEvent, type ReactNode, type RefObject } from 'react'

// One value drives the whole container: 0 = open, 1 = collapsed. It is written to the
// DOM in requestAnimationFrame, never through React state, so a drag costs no render.

// Apple's sheet response with damping 1: settles without overshoot.
const RESPONSE = 0.35
const OMEGA = (2 * Math.PI) / RESPONSE
// Apple's momentum projection ('Designing Fluid Interfaces'): where a flick would come
// to rest, so a short fast swipe still carries the container to the other state.
const DECELERATION = 0.998
const project = (velocity: number) => ((velocity / 1000) * DECELERATION) / (1 - DECELERATION)
// Resistance past either state: the further out, the less the container follows.
const rubberband = (overshoot: number, dimension: number) =>
  (overshoot * dimension * 0.55) / (dimension + 0.55 * Math.abs(overshoot))
// The bar is slightly smaller while the container is open.
const NAV_SCALE_OPEN = 0.94
const VELOCITY_WINDOW_MS = 100

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

export default function Sheet({
  open,
  onOpenChange,
  draggable,
  fit,
  navRef,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  // False on screens without navigation: no handle, no drag, always open.
  draggable: boolean
  // As tall as its content, up to --spacing-sheet-height-max (the create flow, the
  // profile). The drag distance and the handle follow the content's height.
  fit: boolean
  navRef: RefObject<HTMLElement | null>
  children: ReactNode
}) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const handleLayerRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const progress = useRef(open ? 0 : 1)
  const target = useRef(open ? 0 : 1)
  // Distance from the open container's top edge to the bar's top edge: collapsed, the
  // handle sits on the bar.
  const travel = useRef(0)
  const frame = useRef(0)
  const drag = useRef<{ startY: number; startProgress: number; samples: { y: number; t: number }[] } | null>(null)

  const render = useCallback(
    (value: number) => {
      progress.current = value
      const y = `translate3d(0, ${value * travel.current}px, 0)`
      if (sheetRef.current) {
        sheetRef.current.style.transform = y
        // Collapsed, the container must not swallow touches meant for the map.
        sheetRef.current.style.pointerEvents = value > 0.5 ? 'none' : ''
        // Fully collapsed it reaches under Safari's toolbar, and iOS 26 tints the toolbar
        // from any layer at the bottom edge, even an invisible one. Nothing of it shows
        // at this point (surface and content are at opacity 0), so hiding it changes no
        // pixel; the first frame of opening shows it again.
        sheetRef.current.style.visibility = value >= 1 ? 'hidden' : ''
      }
      if (handleLayerRef.current) handleLayerRef.current.style.transform = y
      const visible = String(1 - clamp01(value))
      if (surfaceRef.current) surfaceRef.current.style.opacity = visible
      if (contentRef.current) contentRef.current.style.opacity = visible
      if (navRef.current) {
        navRef.current.style.transform = `scale(${NAV_SCALE_OPEN + (1 - NAV_SCALE_OPEN) * clamp01(value)})`
      }
    },
    [navRef]
  )

  // Critically damped spring, solved exactly rather than stepped, starting from the live
  // value and velocity so a grab or a tab tap mid-flight never jumps.
  const animateTo = useCallback(
    (to: number, velocity = 0) => {
      cancelAnimationFrame(frame.current)
      target.current = to
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        render(to)
        return
      }
      const c1 = progress.current - to
      const c2 = velocity + OMEGA * c1
      const start = performance.now()
      const step = (now: number) => {
        const t = (now - start) / 1000
        const decay = Math.exp(-OMEGA * t)
        const offset = (c1 + c2 * t) * decay
        const speed = (c2 - OMEGA * (c1 + c2 * t)) * decay
        if (Math.abs(offset) < 0.0005 && Math.abs(speed) < 0.005) {
          render(to)
          return
        }
        render(to + offset)
        frame.current = requestAnimationFrame(step)
      }
      frame.current = requestAnimationFrame(step)
    },
    [render]
  )

  useLayoutEffect(() => {
    const measure = () => {
      // offsetTop ignores transforms, so this is the resting layout of both elements.
      travel.current = navRef.current && sheetRef.current ? navRef.current.offsetTop - sheetRef.current.offsetTop : 0
      // A fitted container is only as tall as its content, so the handle's layer takes
      // its height to keep the handle on the container's top edge.
      if (handleLayerRef.current && sheetRef.current) {
        handleLayerRef.current.style.height = fit ? `${sheetRef.current.offsetHeight}px` : ''
      }
      render(progress.current)
    }
    measure()
    // A fitted container changes height with its content (loading, a warning). The
    // fixed-height lists never need this, so it only runs in fit mode.
    const observer = fit ? new ResizeObserver(measure) : null
    if (observer && sheetRef.current) observer.observe(sheetRef.current)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [draggable, fit, navRef, render])

  // State changes from outside (a tab tap, a screen without navigation). A drag release
  // has already set the target, so this does not restart its spring.
  useEffect(() => {
    const to = open ? 0 : 1
    if (target.current !== to) animateTo(to)
  }, [open, animateTo])

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggable || !travel.current) return
    const origin = event.target as HTMLElement
    // Only the handle and the header row drag, never the list body or a button.
    if (!origin.closest('[data-sheet-drag]') || origin.closest('button, a')) return
    cancelAnimationFrame(frame.current)
    // No text selection from the drag: a selection can turn the next drag into a
    // native drag-and-drop, which the browser answers with pointercancel.
    event.preventDefault()
    // On the grabbed element: the handle's layer itself has pointer-events: none.
    origin.setPointerCapture(event.pointerId)
    drag.current = {
      startY: event.clientY,
      startProgress: progress.current,
      samples: [{ y: event.clientY, t: event.timeStamp }],
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state) return
    const distance = travel.current
    const raw = state.startProgress + (event.clientY - state.startY) / distance
    const shown =
      raw < 0 ? rubberband(raw * distance, distance) / distance
      : raw > 1 ? 1 + rubberband((raw - 1) * distance, distance) / distance
      : raw
    render(shown)
    state.samples.push({ y: event.clientY, t: event.timeStamp })
    while (state.samples.length > 2 && event.timeStamp - state.samples[0].t > VELOCITY_WINDOW_MS) state.samples.shift()
  }

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state) return
    drag.current = null
    // Velocity from the recorded moves only. A pointercancel reports clientY 0, so it
    // carries no usable position and settles to the nearer state without momentum.
    const first = state.samples[0]
    const last = state.samples[state.samples.length - 1]
    const elapsed = last.t - first.t
    const pxPerSecond = event.type !== 'pointercancel' && elapsed > 0 ? ((last.y - first.y) / elapsed) * 1000 : 0
    const projected = progress.current + project(pxPerSecond) / travel.current
    const to = projected < 0.5 ? 0 : 1
    animateTo(to, pxPerSecond / travel.current)
    onOpenChange(to === 0)
  }

  const pointerHandlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
    onPointerCancel: onPointerEnd,
  }

  return (
    <>
      <div
        ref={sheetRef}
        {...pointerHandlers}
        className={`fixed inset-x-sheet-gutter bottom-sheet-gutter z-10 flex flex-col will-change-transform ${
          fit ? 'max-h-sheet-height-max' : 'h-sheet-height'
        }`}
      >
        <div ref={surfaceRef} className='absolute inset-0 rounded-sheet bg-main backdrop-blur-sheet' />
        {/* A flex item that may shrink: with a fitted container it is as tall as its
            content until the maximum, then the screen's own body scrolls inside it.
            Rounded and clipped like the surface, so scrolled cards are cut at the
            container's corners. Fixed children (WheelSheet) belong to the container's
            transform, not to this box, and are not clipped by it. */}
        <div ref={contentRef} className='relative flex min-h-0 flex-auto flex-col overflow-hidden rounded-sheet pt-6'>
          {children}
        </div>
      </div>

      {/* The handle has its own layer above the bar, moving with the container: once
          collapsed it sits on the bar's top edge and has to stay grabbable there. The
          layer itself is invisible and only the handle visible: collapsed, the layer
          reaches under Safari's toolbar, which iOS 26 would tint from it. */}
      {draggable && (
        <div
          ref={handleLayerRef}
          {...pointerHandlers}
          className='pointer-events-none invisible fixed inset-x-sheet-gutter bottom-sheet-gutter z-30 h-sheet-height will-change-transform'
        >
          <div
            data-sheet-drag
            aria-hidden
            className='pointer-events-auto visible mx-auto flex h-5 w-30 cursor-grab touch-none select-none justify-center pt-2 active:cursor-grabbing'
          >
            <span className='h-1 w-12.5 rounded-full bg-slider' />
          </div>
        </div>
      )}
    </>
  )
}
