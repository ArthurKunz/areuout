import type { SwatchColor } from '@/components/shared/ColorSwatchPicker'

export const MAX_BYTES = 5 * 1024 * 1024

// Per field, so a full name tops out at 41 characters with the space. The same
// number the party title uses, and enough for the longest names this app will see;
// beyond it the name is only ever shown truncated (the profile's Name row) or
// wrapped (the 25px heading above it) anyway.
export const NAME_MAX = 20

export const BUCKET = 'avatars'

// The seven colour dots of the Profilbild step (App Redesign 9), in the mockup's order.
// The same values as the colour variables in app/globals.css, written out as hex
// because profiles.avatar_color stores hex (profiles_avatar_color_check). Change a
// variable there, change it here.
export const AVATAR_SWATCHES: Record<SwatchColor, string> = {
  orange: '#FF8D28',
  red: '#D32F2F',
  mint: '#00C8B3',
  purple: '#CB30E0',
  yellow: '#FFCC00',
  green: '#34C759',
  blue: '#0088FF',
}

// A colour assigned at random on signup is always one the user could also pick.
export const AVATAR_COLORS = Object.values(AVATAR_SWATCHES)

export const pickRandomAvatarColor = () =>
  AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
