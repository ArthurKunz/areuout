'use client'

import { useLayoutEffect, useRef } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'

// The same 200 m the database blurs a private party's point by (the trigger on events):
// the radius the party is in (App Redesign 3.2, Party Map 7).
const RADAR_METRES = 200

// maplibre's metres per pixel at a latitude: the earth's circumference over a world
// that is 512 px wide at zoom 0 and doubles with every zoom step.
const metresPerPixel = (lat: number, zoom: number) =>
  (40075016.686 * Math.cos((lat * Math.PI) / 180)) / 2 ** (zoom + 9)

// The one rule for when a selected party gets the radar: only where the database handed
// out the blurred point instead of the exact one (is_exact false: a private party the
// viewer has no access to) — the circle says "somewhere in here". Everyone who may see
// the address gets the pin and its dot alone. Every map that shows a selected party asks this.
export const showsRadar = (party: { is_exact: boolean }) => !party.is_exact

// The pulsing circle around a selected party, centred `bottom` px above the bottom edge
// of the marker element it sits in (the pin's dot). Its size is in metres, so it is
// recomputed on every zoom; only the outer element's size changes then, the pulse
// itself is a CSS animation (.radar-pulse in globals.css) on the inner one, so scale and
// opacity never fight the centring transform.
export default function PartyRadar({ map, lat, bottom }: { map: MapLibreMap; lat: number; bottom: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const resize = () => {
      if (!ref.current) return
      const size = `${(2 * RADAR_METRES) / metresPerPixel(lat, map.getZoom())}px`
      ref.current.style.width = size
      ref.current.style.height = size
    }
    resize()
    map.on('zoom', resize)
    return () => {
      map.off('zoom', resize)
    }
  }, [map, lat])

  return (
    <div
      ref={ref}
      aria-hidden
      style={{ bottom }}
      className='pointer-events-none absolute left-1/2 -z-10 -translate-x-1/2 translate-y-1/2'
    >
      <div className='radar-pulse size-full rounded-full bg-green/25 shadow-[0_0_0_1px] shadow-green/30' />
    </div>
  )
}
