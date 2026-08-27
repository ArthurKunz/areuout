'use client'

import { useState } from 'react'
import { Check, ImagePlus } from 'lucide-react'
import { BG_PRESETS } from '../constants/background.constants'

// Der Bildwähler des Erstellen-Flows, unverändert — nur nicht mehr dort eingebaut,
// sondern hier, damit der Bearbeiten-Screen denselben benutzt statt eines zweiten.
// Der Screen behält, was ihn unterscheidet: wohin gespeichert wird und wann.

// The eight wallpapers are ~1.1MB together and arrive one at a time, so each tile
// shimmers until ITS OWN image has decoded and then cross-fades it in — the same
// treatment the party hero and PartyCard give their images. It has to be a component
// rather than inline markup: the loaded flag is per-tile, and state cannot live
// inside the parent's map.
function PresetTile({
  url,
  index,
  selected,
  onSelect,
}: {
  url: string
  index: number
  selected: boolean
  onSelect: () => void
}) {
  const [loaded, setLoaded] = useState(false)

  return (
    <button type='button' onClick={onSelect} className='flex flex-col items-center gap-2'>
      <div
        className={`relative aspect-[3/2] w-full overflow-hidden rounded-[18px] transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95 ${
          loaded ? '' : 'skeleton'
        }`}
      >
        <img
          src={url}
          alt={`Hintergrund ${index + 1}`}
          onLoad={() => setLoaded(true)}
          className={`h-full w-full object-cover transition-opacity duration-500 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full backdrop-blur-xl transition-colors duration-200 ${
          selected ? 'bg-link' : 'border border-white/30'
        }`}
      >
        {selected && <Check size={14} strokeWidth={3} className='text-white' />}
      </span>
    </button>
  )
}

export default function BackgroundPicker({
  previewUrl,
  selectedPreset,
  error,
  onPickFile,
  onSelectPreset,
}: {
  /** Was oben im grossen Kasten steht: ein Objekt-URL des gewählten Fotos, die
   *  Adresse des bereits gespeicherten Hintergrunds — oder nichts. */
  previewUrl: string | null
  selectedPreset: string | null
  error: string | null
  onPickFile: (file: File | null) => void
  onSelectPreset: (url: string) => void
}) {
  // Pro geladenem Vorschaubild, nicht global: wechselt die Vorschau, soll der neue
  // Kasten wieder schimmern, bis SEIN Bild da ist.
  const [previewLoaded, setPreviewLoaded] = useState(false)

  return (
    <>
      <label className='block w-full cursor-pointer'>
        <div
          className={`flex aspect-[2/1] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-[25px] bg-secondary backdrop-blur-xl ${
            previewUrl && !previewLoaded ? 'skeleton' : ''
          }`}
        >
          {previewUrl ? (
            <img
              key={previewUrl}
              src={previewUrl}
              alt=''
              onLoad={() => setPreviewLoaded(true)}
              className={`h-full w-full object-cover transition-opacity duration-500 ${
                previewLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ) : (
            <>
              <div className='flex h-12.5 w-12.5 items-center justify-center rounded-full bg-tertiary backdrop-blur-xl'>
                <ImagePlus size={22} strokeWidth={2} className='text-heading' />
              </div>
              <div className='flex flex-col items-center gap-0.5 px-6 text-center'>
                <span className='text-button text-label-large'>Eigenes Bild hochladen</span>
                <span className='text-label-2 text-subheading'>JPG oder PNG, bis 10 MB</span>
              </div>
            </>
          )}
        </div>
        <input
          type='file'
          accept='image/*'
          className='hidden'
          onChange={(e) => {
            setPreviewLoaded(false)
            onPickFile(e.target.files?.[0] ?? null)
          }}
        />
      </label>

      {error && <span className='px-4 text-label-2 text-warning'>{error}</span>}

      <div className='grid grid-cols-2 gap-3'>
        {BG_PRESETS.map((url, i) => (
          <PresetTile
            key={url}
            url={url}
            index={i}
            selected={selectedPreset === url}
            onSelect={() => {
              setPreviewLoaded(false)
              onSelectPreset(url)
            }}
          />
        ))}
      </div>
    </>
  )
}
