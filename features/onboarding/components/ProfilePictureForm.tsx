'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import StepFrame from '@/features/create-party/StepFrame'
import Avatar from '@/components/shared/Avatar'
import ColorSwatchPicker, { type SwatchColor } from '@/components/shared/ColorSwatchPicker'
import ImageUploadCircle from '@/components/shared/ImageUploadCircle'
import Spinner from '@/components/shared/Spinner'
import WarningBanner from '@/components/shared/WarningBanner'
import { alertError } from '@/lib/utils'
import type { ProfilePictureFormProps } from '../types/onboarding.types'
import { MAX_BYTES, BUCKET, AVATAR_SWATCHES, pickRandomAvatarColor } from '../constants/onboarding.constants'
import { stripMetadataAndResize, AVATAR_MAX_EDGE } from '@/lib/image'
import { getSession } from '../services/onboarding.service'

const CIRCLE = 120

// Two ways of having an avatar (App Redesign 9): a photo, or initials on one of the
// seven colour dots. NOTHING is selected to begin with — the circle shows the upload
// icon until the user picks one or the other, so the screen does not pretend a choice
// has been made for them. With neither, a random one of the seven is saved.
export default function ProfilePictureForm({ onSuccess, onClose, firstname, lastname }: ProfilePictureFormProps) {
  const [color, setColor] = useState<SwatchColor | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  // What this flow has already uploaded, so a second attempt can clear the first.
  const uploadedPath = useRef<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
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

  const selectColor = (value: SwatchColor) => {
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
      await onSuccess(null, color ? AVATAR_SWATCHES[color] : pickRandomAvatarColor())
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

  const openPicker = () => fileRef.current?.click()

  return (
    <StepFrame
      title='Profilbild'
      onBack={onClose}
      button={{ label: saving ? <Spinner /> : 'weiter', onClick: handleDone, disabled: saving }}
    >
      {/* The upload icon until something is picked, then the photo or the initials on
          the chosen colour, both with the pencil badge. Every state opens the file picker. */}
      <ImageUploadCircle imageUrl={previewUrl} onClick={openPicker}>
        {color && <Avatar size={CIRCLE} url={null} color={AVATAR_SWATCHES[color]} firstname={firstname} lastname={lastname} />}
      </ImageUploadCircle>
      <input
        ref={fileRef}
        type='file'
        accept='image/*'
        hidden
        onChange={(e) => {
          onPickFile(e.target.files?.[0] ?? null)
          // Lets the same file be picked again after an error.
          e.target.value = ''
        }}
      />

      <ColorSwatchPicker value={color} onChange={selectColor} />

      {warning && <WarningBanner message={warning} />}
    </StepFrame>
  )
}
