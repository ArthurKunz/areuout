'use client'

import { useState } from 'react'
import Avatar from '@/components/shared/Avatar'
import BigButton from '@/components/shared/BigButton'
import { supabase } from '@/lib/supabase/client'
import { alertError } from '@/lib/utils'
import ConfirmPrompt from './ConfirmPrompt'
import ReportPrompt from './ReportPrompt'

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
// `Blockieren` and `Melden` (step 13b). block_user also removes them from my upcoming
// parties and me from theirs (SCHEMA.md 9c); the detail then closes what still shows them.
export default function ProfilePage({ user, onBlocked }: { user: ProfileUser; onBlocked: (userId: string) => void }) {
  const [prompt, setPrompt] = useState<'block' | 'report' | null>(null)
  const [blocking, setBlocking] = useState(false)
  const name = [user.firstname, user.lastname].filter(Boolean).join(' ') || 'Unbekannt'

  const block = async () => {
    setBlocking(true)
    const { error } = await supabase.rpc('block_user', { p_user_id: user.id })
    setBlocking(false)
    if (error) {
      alertError(`${name} konnte nicht blockiert werden.`, error.message)
      return
    }
    setPrompt(null)
    onBlocked(user.id)
  }

  return (
    <div className='flex flex-col items-center gap-5'>
      <Avatar size={125} url={user.avatarUrl} color={user.avatarColor} firstname={user.firstname} lastname={user.lastname} />
      <h2 className='text-center text-heading-1 font-bold break-words text-heading'>{name}</h2>
      <div className='flex w-full max-w-[350px] gap-3'>
        <BigButton variant='white' onClick={() => setPrompt('block')}>
          Blockieren
        </BigButton>
        <BigButton variant='red' onClick={() => setPrompt('report')}>
          Melden
        </BigButton>
      </div>

      <ConfirmPrompt
        open={prompt === 'block'}
        title={`${name} blockieren?`}
        message='Die Person wird aus deinen kommenden Partys entfernt, und deine Zu- und Absagen zu ihren kommenden Partys werden gelöscht. Entblocken bringt beides nicht zurück.'
        confirmLabel='Blockieren'
        pending={blocking}
        onConfirm={block}
        onCancel={() => setPrompt(null)}
      />
      <ReportPrompt
        open={prompt === 'report'}
        title={`${name} melden`}
        target={{ kind: 'user', reportedUserId: user.id }}
        onClose={() => setPrompt(null)}
      />
    </div>
  )
}
