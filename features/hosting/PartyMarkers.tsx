'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Map as MapLibreMap, Marker } from 'maplibre-gl'
import { useShellMap } from '@/components/shell/MapContext'
import PartyMapPin from '@/features/parties/components/PartyMapPin'
import PartyRadar, { showsRadar } from '@/features/party-detail/PartyRadar'

export type MarkerParty = { id: string; lat: number; lng: number; background_url: string; title: string; is_public: boolean }

// The dot under the pin marks the exact spot; its centre sits on the coordinates.
const DOT = 6

// Every party as a picture circle on the shell map, and the selected one as the pin
// (App Redesign 3.2). DOM markers, so circles that overlap simply stack and spread
// apart as the user zooms in; there is no clustering. Leaving the screen removes them.
export default function PartyMarkers({
  parties,
  selectedId,
  onSelect,
}: {
  parties: MarkerParty[]
  selectedId: string | null
  onSelect: (party: MarkerParty) => void
}) {
  const { map } = useShellMap()
  // maplibre needs `window`, so it is loaded here like in ShellMap. The class goes into
  // state through a function, or React would call it as an updater.
  const [MarkerClass, setMarkerClass] = useState<typeof Marker | null>(null)
  useEffect(() => {
    import('maplibre-gl').then((maplibre) => setMarkerClass(() => maplibre.Marker))
  }, [])

  if (!map || !MarkerClass) return null

  return parties.map((party) => {
    const selected = party.id === selectedId
    // A marker's anchor is fixed once created, so the circle and the pin are separate
    // markers: the key changes with the selection and the old one is removed.
    return (
      <PartyMarker
        key={`${party.id}:${selected ? 'pin' : 'circle'}`}
        map={map}
        MarkerClass={MarkerClass}
        party={party}
        selected={selected}
        onSelect={onSelect}
      />
    )
  })
}

function PartyMarker({
  map,
  MarkerClass,
  party,
  selected,
  onSelect,
}: {
  map: MapLibreMap
  MarkerClass: typeof Marker
  party: MarkerParty
  selected: boolean
  onSelect: (party: MarkerParty) => void
}) {
  const [element] = useState(() => document.createElement('div'))

  useEffect(() => {
    // The pin hangs above its dot: anchored at the bottom and pushed down by half the
    // dot, so the dot's centre is the exact spot. The circle is centred on it.
    const marker = new MarkerClass({
      element,
      anchor: selected ? 'bottom' : 'center',
      offset: selected ? [0, DOT / 2] : [0, 0],
    })
      .setLngLat([party.lng, party.lat])
      .addTo(map)
    // The pin lies over every circle it overlaps.
    if (selected) marker.getElement().style.zIndex = '1'
    return () => {
      marker.remove()
    }
  }, [map, MarkerClass, element, party.lng, party.lat, selected])

  return createPortal(
    selected ? (
      <div className='relative isolate flex flex-col items-center gap-0.5'>
        {showsRadar(party) && <PartyRadar map={map} lat={party.lat} bottom={DOT / 2} />}
        <PartyMapPin imageUrl={party.background_url} alt={party.title} active />
        <span className='rounded-full bg-pin-border' style={{ width: DOT, height: DOT }} />
      </div>
    ) : (
      <button type='button' aria-label={party.title} onClick={() => onSelect(party)} className='block'>
        <PartyMapPin imageUrl={party.background_url} alt='' />
      </button>
    ),
    element
  )
}
