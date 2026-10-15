'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert } from 'lucide-react'
import { FitSheet } from '@/components/shell/Shell'
import StepFrame from '@/features/create-party/StepFrame'
import Avatar from '@/components/shared/Avatar'
import LoadError from '@/components/shared/LoadError'
import { Alert, AlertDescription, AlertTitle } from '@/components/shared/Alert'
import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Blocked = Database['public']['Functions']['get_my_blocked_users']['Returns'][number]

const fullName = (person: Blocked) => [person.firstname, person.lastname].filter(Boolean).join(' ') || 'Unbekannt'

// Page `Blockiert` (step 13b), from `Blockierte Personen` on the profile: everyone the
// viewer blocked, newest first as get_my_blocked_users returns them, built like the
// guest list's rows. `Entblocken` takes the person off the list at once and puts them
// back if unblock_user fails; unblocking restores nothing that block_user removed.
export default function MeBlockedScreen() {
  const router = useRouter()
  const [people, setPeople] = useState<Blocked[] | null>(null)
  // A failed load shows LoadError instead of the list; each retry loads again.
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [unblockFailed, setUnblockFailed] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('get_my_blocked_users').then(({ data, error }) => {
      if (error) {
        console.error('[areuout]', error.message)
        setFailed(true)
        return
      }
      setPeople(data)
    })
  }, [attempt])

  const unblock = async (person: Blocked) => {
    setUnblockFailed(null)
    const index = people?.indexOf(person) ?? 0
    setPeople((current) => current?.filter((item) => item.id !== person.id) ?? null)
    const { error } = await supabase.rpc('unblock_user', { p_user_id: person.id })
    if (error) {
      console.error('[areuout]', error.message)
      // Back to where it was, from the list as it is now: another may have left meanwhile.
      setPeople((current) => current && [...current.slice(0, index), person, ...current.slice(index)])
      setUnblockFailed(`${fullName(person)} konnte nicht entblockt werden.`)
    }
  }

  return (
    <>
      <FitSheet />
      <StepFrame title='Blockiert' onBack={() => router.push('/me')} button={null}>
        {failed ? (
          <div className='w-full max-w-[350px]'>
            <LoadError
              text='Die Liste konnte nicht geladen werden.'
              onRetry={() => {
                setFailed(false)
                setAttempt((n) => n + 1)
              }}
            />
          </div>
        ) : !people ? (
          <div className='h-27.5 w-full max-w-[350px] rounded-[25px] skeleton' />
        ) : (
          <>
            {unblockFailed && (
              <div className='w-full max-w-[350px]'>
                <Alert>
                  <CircleAlert />
                  <AlertTitle>Das ging nicht</AlertTitle>
                  <AlertDescription>{unblockFailed}</AlertDescription>
                </Alert>
              </div>
            )}
            {people.length === 0 ? (
              <span className='pt-2 text-center text-text-2 text-text'>Du hast niemanden blockiert</span>
            ) : (
              <ul className='flex w-full max-w-[350px] flex-col rounded-[25px] bg-main px-4 py-1'>
                {people.map((person, i) => (
                  <li key={person.id}>
                    {i > 0 && <div className='h-px w-full bg-divider' />}
                    <div className='flex h-12.5 items-center gap-3'>
                      <Avatar
                        size={30}
                        url={person.avatar_url}
                        color={person.avatar_color}
                        firstname={person.firstname}
                        lastname={person.lastname}
                      />
                      <span className='min-w-0 flex-1 truncate text-text-3 font-bold text-heading'>{fullName(person)}</span>
                      <button
                        type='button'
                        onClick={() => unblock(person)}
                        className='shrink-0 text-text-3 font-semibold text-brand transition-opacity duration-(--duration-press) ease-ios active:opacity-60'
                      >
                        Entblocken
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </StepFrame>
    </>
  )
}
