'use client'

import RsvpStatusButton from './RsvpStatusButton'

// The 350px-wide RSVP bar shown on an invite: decline (red X) and maybe
// (yellow ?) on either side — both just RsvpStatusButton — with the
// "Teilnehmen" pill filling the space between them.
export default function RsvpInviteBar({
  onGoing,
  onMaybe,
  onNotGoing,
}: {
  onGoing?: () => void
  onMaybe?: () => void
  onNotGoing?: () => void
}) {
  return (
    <div className='flex w-[350px] items-center justify-between gap-3'>
      <RsvpStatusButton status='not_going' onClick={onNotGoing} />
      <button
        type='button'
        onClick={onGoing}
        className='flex h-[45px] flex-1 items-center justify-center rounded-full bg-green text-text-1 font-semibold text-heading backdrop-blur-[100px]'
      >
        Teilnehmen
      </button>
      <RsvpStatusButton status='maybe' onClick={onMaybe} />
    </div>
  )
}
