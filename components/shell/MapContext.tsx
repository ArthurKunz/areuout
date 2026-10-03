'use client'

import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'

type Target = { lng: number; lat: number }

type MapRegistry = {
  register: (map: MapLibreMap | null) => void
  flyTo: (lng: number, lat: number) => void
}

const MapContext = createContext<MapRegistry | null>(null)

const ZOOM = 15

function move(map: MapLibreMap, { lng, lat }: Target) {
  const options = { center: [lng, lat] as [number, number], zoom: ZOOM }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) map.jumpTo(options)
  else map.flyTo(options)
}

// Lets any screen in app/(shell) move the one map behind the container. The map itself
// stays in ShellMap; this only holds a reference to it. Refs, not state: registering
// the map or moving it never needs a render.
export function MapProvider({ children }: { children: ReactNode }) {
  const mapRef = useRef<MapLibreMap | null>(null)
  // A flyTo that arrived before the map existed (the map loads asynchronously, so after
  // a refresh a screen can be faster than it). Applied once the map registers.
  const pending = useRef<Target | null>(null)

  const value = useMemo<MapRegistry>(
    () => ({
      register(map) {
        mapRef.current = map
        if (map && pending.current) {
          move(map, pending.current)
          pending.current = null
        }
      },
      flyTo(lng, lat) {
        if (mapRef.current) move(mapRef.current, { lng, lat })
        else pending.current = { lng, lat }
      },
    }),
    []
  )

  return <MapContext value={value}>{children}</MapContext>
}

// For ShellMap only: hands its maplibre instance in when created, null when removed.
export function useRegisterShellMap() {
  const registry = useContext(MapContext)
  if (!registry) throw new Error('useRegisterShellMap must be used inside MapProvider')
  return registry.register
}

export function useShellMap(): { flyTo: (lng: number, lat: number) => void } {
  const registry = useContext(MapContext)
  if (!registry) throw new Error('useShellMap must be used inside MapProvider')
  return { flyTo: registry.flyTo }
}
