import Chip from '@/components/shared/Chip'

// The six features of step 5, in the order their chips appear (App Redesign 7.3).
export const FEATURES = [
  { key: 'motto', variant: 'motto', label: 'Motto' },
  { key: 'maxGuests', variant: 'maxParticipants', label: 'max. Teilnehmer' },
  { key: 'dresscode', variant: 'dresscode', label: 'Dresscode' },
  { key: 'polls', variant: 'poll', label: 'Umfrage' },
  { key: 'questions', variant: 'question', label: 'Frage' },
  { key: 'description', variant: 'description', label: 'Beschreibung' },
] as const

export type Feature = (typeof FEATURES)[number]['key']

// A sub-step's title: its feature's coloured chip, not tappable.
export default function FeatureChip({ feature }: { feature: Feature }) {
  const { variant, label } = FEATURES.find((f) => f.key === feature)!
  return <Chip variant={variant}>{label}</Chip>
}
