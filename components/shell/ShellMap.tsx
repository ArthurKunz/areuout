'use client'

import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import type { Map as MapLibreMap, MapOptions } from 'maplibre-gl'
import baseStyle from '@/lib/map/style.json'
import { GLYPHS_URL, LEIPZIG_BOUNDS, SPRITE_URL, TILE_SOURCE_URL } from '@/lib/map/config'

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

  useEffect(() => {
    let map: MapLibreMap | undefined
    let cancelled = false

    // Loaded here rather than at the top: maplibre needs `window`, and this keeps it
    // out of the server render and out of the first bundle.
    import('maplibre-gl').then(({ Map, AttributionControl, setWorkerUrl }) => {
      if (cancelled || !container.current) return
      // Copied there by scripts/copy-maplibre-worker.mjs; see that file for why.
      setWorkerUrl('/maplibre/maplibre-gl-worker.mjs')
      map = new Map({
        container: container.current,
        style,
        bounds: LEIPZIG_BOUNDS,
        // Fitted to the whole screen, as in the mockups: collapsed shows Brehna to Lucka,
        // open puts Leipzig at the container's top edge. Collapsing does not re-zoom.
        fitBoundsOptions: { padding: 16 },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: false,
      })
      map.touchZoomRotate.disableRotation()
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
      map?.remove()
    }
  }, [])

  return (
    // 100lvh, not dvh: the map runs under Safari's bars instead of stopping at them.
    // The wrapper carries the positioning because maplibre's own CSS sets the
    // container to position: relative.
    <div className='fixed inset-x-0 top-0 z-0 h-lvh'>
      <div ref={container} className='h-full w-full' />
    </div>
  )
}
