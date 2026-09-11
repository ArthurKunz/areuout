'use client'

import { useState } from 'react'

export default function PartyMap({ location }: { location: string }) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
  const query = encodeURIComponent(location)
  // A static PNG decodes before onLoad fires, unlike the old iframe embed whose
  // onLoad only meant Google's JS bootstrap had arrived — the tiles came seconds later.
  // Der Marker trägt die Akzentfarbe als Fläche, also die Basis der Skala und nicht
  // den Tint — auf einer hellen Karte ist das der Schritt mit Kontrast.
  const src = `https://maps.googleapis.com/maps/api/staticmap?center=${query}&zoom=15&size=640x246&scale=2&markers=color:0x1E5CFF%7C${query}&key=${key}`
  const href = `https://www.google.com/maps/search/?api=1&query=${query}`

  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <a
      href={href}
      target='_blank'
      rel='noopener noreferrer'
      aria-label={`${location} in Google Maps öffnen`}
      className='relative block overflow-hidden rounded-2xl border border-border h-33 w-full'
    >
      {failed ? (
        // Keeps the block tappable if the Static Maps API is off or the key is missing,
        // rather than leaving a skeleton shimmering forever.
        <div className='absolute inset-0 bg-secondary backdrop-blur-xl flex items-center justify-center'>
          <span className='text-label-2 text-label-small'>In Google Maps öffnen</span>
        </div>
      ) : (
        <>
          <img
            src={src}
            alt=''
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`h-full w-full object-cover transition-opacity duration-500 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {!loaded && <div className='absolute inset-0 skeleton' />}
        </>
      )}
    </a>
  )
}
