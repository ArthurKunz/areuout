'use client'

import Avatar from '@/components/shared/Avatar'
import BigButton from '@/components/shared/BigButton'

// Exactly what the tapped row already showed: no query fetches anything more.
export type ProfileUser = {
  id: string
  firstname: string | null
  lastname: string | null
  avatarUrl: string | null
  avatarColor: string | null
}

// The mini profile of someone else (mockup User Profile 01), opened by tapping their
// picture or name inside the detail: the picture large, the full name, and below
// `Blockieren` and `Melden`. Both are shown only, disabled like the `Apple` button on the
// start screen, until step 13b gives them their tables.
export default function ProfilePage({ user }: { user: ProfileUser }) {
  return (
    <div className='flex flex-col items-center gap-5'>
      <Avatar size={125} url={user.avatarUrl} color={user.avatarColor} firstname={user.firstname} lastname={user.lastname} />
      <h2 className='text-center text-heading-1 font-bold break-words text-heading'>
        {[user.firstname, user.lastname].filter(Boolean).join(' ') || 'Unbekannt'}
      </h2>
      <div className='flex w-full max-w-[350px] gap-3'>
        <BigButton variant='white' disabled>
          Blockieren
        </BigButton>
        <BigButton variant='red' disabled>
          Melden
        </BigButton>
      </div>
    </div>
  )
}
