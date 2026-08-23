// Every picture a user picks goes through here before it is uploaded.
//
// The reason is what a phone photo actually contains. A real avatar from this app,
// read back out of the bucket, carried: GPS 51.3456 N / 12.3606 E, "iPhone 12 Pro",
// iOS 14.7.1, and the minute it was taken — 2569x3347 pixels, 1 MB, stored exactly as
// the camera wrote it. Anyone holding the URL could read where that person had been.
//
// Re-encoding through a canvas is what removes it. A canvas holds pixels and nothing
// else: EXIF, GPS, maker notes and colour profiles do not survive the round trip. The
// resize is the second half of the point — a 100px avatar has no business being a
// 2569px original, and the smaller file is the one a phone on mobile data has to pull
// for every face in a guest list.

// Long edge in pixels. Avatars render at 100px at the very most, backgrounds fill a
// 400px-tall hero — both generous enough for a 3x display with room to spare.
export const AVATAR_MAX_EDGE = 512
export const BACKGROUND_MAX_EDGE = 1600

const QUALITY = 0.85

/**
 * Decodes, rotates upright, shrinks and re-encodes a picked file as JPEG.
 *
 * Throws rather than falling back to the original. Uploading the untouched file when
 * the cleaning step fails would be the one outcome worth avoiding, because it is the
 * silent one: the picture would look right and still carry the coordinates.
 */
export async function stripMetadataAndResize(file: File, maxEdge: number): Promise<File> {
  // 'from-image' applies the EXIF orientation flag while decoding. Without it a photo
  // shot in portrait decodes on its side, because the flag that said "rotate me" is
  // exactly the metadata being dropped.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('Canvas nicht verfügbar')
  }

  // JPEG has no alpha channel, so anything transparent would come out black. White is
  // the surface these pictures sit on everywhere in the app.
  context.fillStyle = '#FFFFFF'
  context.fillRect(0, 0, width, height)
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY)
  )
  if (!blob) throw new Error('Bild konnte nicht umgewandelt werden')

  // Always .jpg from here on, whatever went in. The callers used to carry the original
  // extension through into the storage path, which would now be a lie.
  return new File([blob], 'upload.jpg', { type: 'image/jpeg' })
}
