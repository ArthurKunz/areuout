'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Check, Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import Avatar from '@/components/shared/Avatar'
import Spinner from '@/components/shared/Spinner'
import SheetLayout, { sheetButtonClass } from '@/components/shared/SheetLayout'
import WarningBanner from '@/components/shared/WarningBanner'
import { alertError, cn } from '@/lib/utils'
import type { ProfilePictureFormProps } from '../types/onboarding.types'
import { MAX_BYTES, BUCKET, AVATAR_COLORS, pickRandomAvatarColor } from '../constants/onboarding.constants'
import { stripMetadataAndResize, AVATAR_MAX_EDGE } from '@/lib/image'
import { getSession } from '../services/onboarding.service'

// The same two ways of having an avatar as the profile's picture screen: a photo,
// or initials on one of the nine party colours. NOTHING is selected to begin with —
// the circle shows the default silhouette until the user picks one or the other, so
// the screen does not pretend a choice has been made for them.
export default function ProfilePictureForm({ onSuccess, onClose, firstname, lastname }: ProfilePictureFormProps) {
  const [color, setColor] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  // What this flow has already uploaded, so a second attempt can clear the first.
  const uploadedPath = useRef<string | null>(null)
  // Picking the wrong file is the user's to fix, right here, so it is a banner and
  // not an alert — see features/auth/services/auth-errors.ts for the rule.
  const [warning, setWarning] = useState<string | null>(null)

  const onPickFile = (picked: File | null) => {
    if (!picked) return
    if (!picked.type.startsWith('image/')) {
      setWarning('Bitte ein Bild auswählen')
      return
    }
    if (picked.size > MAX_BYTES) {
      setWarning('Das Bild ist größer als 5 MB')
      return
    }
    setWarning(null)
    // Photo and initials are alternatives, so picking one drops the other.
    setColor(null)
    setFile(picked)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(picked)
    })
  }

  const selectColor = (value: string) => {
    setColor(value)
    setFile(null)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  const handleDone = async () => {
    if (saving) return
    setSaving(true)

    // Initials: nothing to upload, the colour goes straight into the profile row.
    if (!file) {
      await onSuccess(null, color ?? pickRandomAvatarColor())
      setSaving(false)
      return
    }

    const { data: { session } } = await getSession()
    if (!session) {
      setSaving(false)
      alertError('Du bist nicht angemeldet.')
      return
    }

    // Never the file the user picked: a camera photo carries GPS coordinates and the
    // device it was taken with, and the bucket hands those out to anyone with the URL.
    // stripMetadataAndResize throws rather than quietly passing the original through.
    let clean: File
    try {
      clean = await stripMetadataAndResize(file, AVATAR_MAX_EDGE)
    } catch {
      setSaving(false)
      alertError('Dieses Bild konnte nicht verarbeitet werden. Versuch es mit einem anderen.')
      return
    }

    // Always .jpg — that is what comes back out of the canvas.
    const path = `${session.user.id}/avatar-${Date.now()}.jpg`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, clean, { cacheControl: '3600', upsert: false })
    if (uploadError) {
      setSaving(false)
      alertError('Dein Bild konnte nicht hochgeladen werden.', uploadError.message)
      return
    }
    // Going back a step and picking another picture uploads under a new timestamped
    // name, so whatever this flow uploaded before is now unreferenced.
    if (uploadedPath.current) await supabase.storage.from(BUCKET).remove([uploadedPath.current])
    uploadedPath.current = path

    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    await onSuccess(publicUrl, pickRandomAvatarColor())
    setSaving(false)
  }

  return (
    <SheetLayout title='Profilbild' onClose={onClose}>
      {/* One wrapper, so the sheet's gap-5 does not compound with the margins below:
          the 36px and 28px here reproduce EditPictureScreen exactly, where a mt-6 grid
          and a mt-4 button sit in SettingsPage's gap-3 column. */}
      <div className='flex flex-col'>
        {/* The circle is the file input; the pencil badge is decoration on top of it. */}
        <label className='flex cursor-pointer justify-center'>
          <div className='group relative'>
            {previewUrl || color ? (
              <Avatar
                size={175}
                url={previewUrl}
                color={color}
                firstname={firstname}
                lastname={lastname}
                className='transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95'
              />
            ) : (
              <Image
                src='/images/noProfilPicture.jpg'
                alt=''
                width={175}
                height={175}
                priority
                // The asset is a grey figure on a WHITE ground, so on the white sheet
                // the circle has no edge of its own — the hairline is what makes it
                // read as an avatar rather than a shape floating in the page.
                className='h-43.75 w-43.75 rounded-full border-border border-sheet-body/40 object-cover transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95'
              />
            )}
            <span className='absolute bottom-1 right-1 flex h-11.25 w-11.25 items-center justify-center rounded-full bg-button-primary transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] group-active:scale-95'>
              <Pencil size={18} strokeWidth={2.5} className='text-sheet' />
            </span>
          </div>
          <input
            type='file'
            accept='image/*'
            className='hidden'
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <div className='mt-9 grid grid-cols-3 gap-3'>
          {AVATAR_COLORS.map((value) => (
            <button key={value} type='button' onClick={() => selectColor(value)} className='flex flex-col items-center gap-2'>
              <Avatar
                size={90}
                url={null}
                color={value}
                firstname={firstname}
                lastname={lastname}
                className='transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95'
              />
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-200 ${
                  color === value ? 'bg-link' : 'border border-sheet-body/50'
                }`}
              >
                {color === value && <Check size={14} strokeWidth={3} className='text-white animate-fade-in-up' />}
              </span>
            </button>
          ))}
        </div>

        {warning && <div className='mt-7'><WarningBanner message={warning} /></div>}

        <button
          type='button'
          onClick={handleDone}
          disabled={saving}
          className={cn(sheetButtonClass, 'mt-7 h-12.5')}
        >
          {saving ? <Spinner /> : 'fertig'}
        </button>
      </div>
    </SheetLayout>
  )
}
