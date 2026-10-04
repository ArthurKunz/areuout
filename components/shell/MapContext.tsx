'use client'

import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'

type Target = { lng: number; lat: number }

type MapRegistry = {
  register: (map: MapLibreMap | null) => void
  flyTo: (lng: number, lat: number) => void
  map: MapLibreMap | null
}

const MapContext = createContext<MapRegistry | null>(null)

const ZOOM = 15

// The open container covers the bottom of the map: its height plus the gutter under it.
// Read from the same variables Sheet uses (resolved through a probe element, since
// 50svh only becomes pixels in layout), so the party lands in the middle of the map
// that is still visible above the container.
function containerInset() {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;visibility:hidden;height:calc(var(--spacing-sheet-height) + var(--spacing-sheet-gutter))'
  document.body.appendChild(probe)
  const height = probe.getBoundingClientRect().height
  probe.remove()
  return height
}

function move(map: MapLibreMap, { lng, lat }: Target) {
  // maplibre keeps the padding after the move, so later camera moves also centre on
  // the visible part above the container.
  const options = { center: [lng, lat] as [number, number], zoom: ZOOM, padding: { top: 0, right: 0, left: 0, bottom: containerInset() } }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) map.jumpTo(options)
  else map.flyTo(options)
}

// Lets any screen in app/(shell) move the one map behind the container. The map itself
// stays in ShellMap; this only holds a reference to it. flyTo works from a ref, so moving
// never needs a render; the instance is also kept in state for screens that put markers
// on it, which have to render once it exists.
export function MapProvider({ children }: { children: ReactNode }) {
  const mapRef = useRef<MapLibreMap | null>(null)
  const [map, setMap] = useState<MapLibreMap | null>(null)
  // A flyTo that arrived before the map existed (the map loads asynchronously, so after
  // a refresh a screen can be faster than it). Applied once the map registers.
  const pending = useRef<Target | null>(null)

  // register and flyTo keep one identity for the provider's lifetime: ShellMap's effect
  // depends on register, and a new one would tear the map down and build it again.
  const actions = useMemo<Omit<MapRegistry, 'map'>>(
    () => ({
      register(instance) {
        mapRef.current = instance
        setMap(instance)
        if (instance && pending.current) {
          move(instance, pending.current)
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
  const value = useMemo<MapRegistry>(() => ({ ...actions, map }), [actions, map])

  return <MapContext value={value}>{children}</MapContext>
}

// For ShellMap only: hands its maplibre instance in when created, null when removed.
export function useRegisterShellMap() {
  const registry = useContext(MapContext)
  if (!registry) throw new Error('useRegisterShellMap must be used inside MapProvider')
  return registry.register
}

export function useShellMap(): { flyTo: (lng: number, lat: number) => void; map: MapLibreMap | null } {
  const registry = useContext(MapContext)
  if (!registry) throw new Error('useShellMap must be used inside MapProvider')
  return { flyTo: registry.flyTo, map: registry.map }
}
