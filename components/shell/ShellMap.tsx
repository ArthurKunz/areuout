'use client'

import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { Map as MapLibreMap, MapOptions } from 'maplibre-gl'
import baseStyle from '@/lib/map/style.json'
import { GLYPHS_URL, LEIPZIG_BOUNDS, SPRITE_URL, TILE_SOURCE_URL } from '@/lib/map/config'
import { containerInset, runwayInset, useRegisterShellMap } from '@/components/shell/MapContext'

type Style = Exclude<MapOptions['style'], string | undefined>

// The style file carries layers only; the sources come from lib/map/config.ts so the
// tile provider can be swapped in one place.
const style = {
  ...(baseStyle as unknown as Style),
  sources: { openmaptiles: { type: 'vector', url: TILE_SOURCE_URL } },
  glyphs: GLYPHS_URL,
  sprite: SPRITE_URL,
} satisfies Style

// The full-screen map behind every shell screen. It lives in app/(shell)/layout.tsx,
// which Next keeps mounted across tab changes, so it is created exactly once and keeps
// its position while the tabs swap above it.
export default function ShellMap() {
  const container = useRef<HTMLDivElement>(null)
  const register = useRegisterShellMap()

  useEffect(() => {
    let map: MapLibreMap | undefined
    let cancelled = false

    // Loaded here rather than at the top: maplibre needs `window`, and this keeps it
    // out of the server render and out of the first bundle.
    import('maplibre-gl').then(({ Map, AttributionControl, setWorkerUrl }) => {
      if (cancelled || !container.current) return
      // Copied there by scripts/copy-maplibre-worker.mjs; see that file for why.
      setWorkerUrl('/maplibre/maplibre-gl-worker.mjs')
      const runway = runwayInset()
      map = new Map({
        container: container.current,
        style,
        bounds: LEIPZIG_BOUNDS,
        // Fitted to the whole screen, as in the mockups: collapsed shows Brehna to Lucka,
        // open puts Leipzig at the container's top edge. Collapsing does not re-zoom.
        // The runway past the screen's edges is left out, and on a wide screen the
        // container at the left.
        fitBoundsOptions: {
          padding: { top: runway.top + 16, bottom: runway.bottom + 16, left: containerInset().left + 16, right: 16 },
        },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: false,
      })
      map.touchZoomRotate.disableRotation()
      // Screens move the map through MapContext's flyTo; a target that arrived before
      // this point is applied here.
      register(map)
      // The OSM licence requires the attribution; top-right keeps it clear of the container.
      map.addControl(new AttributionControl({ compact: true }), 'top-right')
      // Compact still opens itself once the style arrives and only folds on the first
      // drag; fold it right away so it starts as the small icon. Same class maplibre
      // removes on drag.
      map.once('load', () => {
        container.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
      })
    })

    return () => {
      cancelled = true
      if (map) register(null)
      map?.remove()
    }
  }, [register])

  // Keeps the page scrolled to the runway's top (globals.css): nobody can scroll it, but
  // a navigation or the keyboard can. Typing is left alone, since iOS scrolls the page
  // to the focused field; the page goes back once the field loses focus.
  useLayoutEffect(() => {
    const settle = () => {
      if (document.activeElement?.matches('input, textarea, select')) return
      const top = runwayInset().top
      if (window.scrollY !== top) window.scrollTo(0, top)
    }
    // focusout fires while the field still holds focus.
    const settleAfterBlur = () => requestAnimationFrame(settle)
    settle()
    window.addEventListener('scroll', settle, { passive: true })
    window.addEventListener('resize', settle)
    document.addEventListener('focusout', settleAfterBlur)
    return () => {
      window.removeEventListener('scroll', settle)
      window.removeEventListener('resize', settle)
      document.removeEventListener('focusout', settleAfterBlur)
    }
  }, [])

  return (
    // The runway above the screen, the screen at 100lvh (not dvh, so it also covers
    // the space Safari's bars take), and the runway below it. Absolute, not fixed: iOS
    // 26 Safari draws only page content under its bars and fills them with a flat
    // colour wherever a fixed layer reaches an edge. The wrapper carries the
    // positioning because maplibre's own CSS sets the container to position: relative.
    <div data-runway className='absolute inset-x-0 top-0 z-0 h-[calc(var(--spacing-runway-top)+100lvh+var(--spacing-runway-bottom))]'>
      <div ref={container} className='h-full w-full' />
    </div>
  )
}
