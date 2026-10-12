'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FitSheet, HideShell } from '@/components/shell/Shell'
import BigButton from '@/components/shared/BigButton'
import LoadError from '@/components/shared/LoadError'
import { useShellMap } from '@/components/shell/MapContext'
import AuthSheet from '@/features/auth/components/AuthSheet'
import PartyMarkers, { type MarkerParty } from '@/features/hosting/PartyMarkers'
import { getPartyByInviteCode } from '@/features/parties/services/parties.service'
import PartyDetail, { DetailSkeleton } from '@/features/party-detail/PartyDetail'
import { supabase } from '@/lib/supabase/client'

type State =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'missing'; signedIn: boolean }
  | { kind: 'signedOut' }
  | { kind: 'party'; id: string; isHost: boolean }

// The invite page (App Redesign 4.3): the party's detail container over the map, zoomed
// to its exact pin, without navigation. Resolving the code through
// get_party_by_invite_code records the invite open, and from then on get_party_detail
// hands this person the address and the exact point, private parties included: the
// link is the invitation.
export default function InviteScreen({ inviteCode }: { inviteCode: string }) {
  const router = useRouter()
  const { flyTo } = useShellMap()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [pin, setPin] = useState<MarkerParty | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([getPartyByInviteCode(inviteCode), supabase.auth.getSession()]).then(([{ party, failed }, session]) => {
      if (cancelled) return
      const userId = session.data.session?.user.id ?? null
      if (failed) setState({ kind: 'failed' })
      // One answer for every code that is not live: never handed out, reset, deleted or
      // mistyped all look the same, so the page tells nobody whether a code once existed.
      else if (!party) setState({ kind: 'missing', signedIn: userId !== null })
      else if (!userId) setState({ kind: 'signedOut' })
      else setState({ kind: 'party', id: party.id, isHost: party.host_id === userId })
    })
    return () => {
      cancelled = true
    }
  }, [inviteCode, attempt])

  // Signing up from an invite has to come back to that invite (User Flows, Flow 2).
  const inviteNext = `/e/${inviteCode}`
  const loginHref = `/login?next=${encodeURIComponent(inviteNext)}`

  return (
    <>
      <HideShell />
      {pin && <PartyMarkers parties={[pin]} selectedId={pin.id} onSelect={() => {}} />}
      {state.kind === 'loading' && <DetailSkeleton onClose={() => router.push('/my-parties')} />}
      {state.kind === 'failed' && (
        <div className='px-5 pt-4 pb-6'>
          <LoadError
            text='Die Party konnte nicht geladen werden.'
            onRetry={() => {
              setState({ kind: 'loading' })
              setAttempt((n) => n + 1)
            }}
          />
        </div>
      )}
      {/* A dead link still needs a way out: the page has no navigation. */}
      {state.kind === 'missing' && state.signedIn && (
        <>
          <FitSheet />
          <div className='flex flex-col items-center gap-3 overflow-y-auto px-5 pb-6'>
            <h1 className='text-center text-heading-1 font-bold text-heading'>Dieser Link gilt nicht mehr</h1>
            <p className='max-w-[350px] text-center text-text-2 text-text'>
              Vielleicht wurde er zurückgesetzt oder die Party gelöscht. Frag nach dem aktuellen Link.
            </p>
            <BigButton variant='main' onClick={() => router.push('/explore')}>
              Zu Explore
            </BigButton>
          </div>
        </>
      )}
      {state.kind === 'missing' && !state.signedIn && (
        <>
          <FitSheet />
          <AuthSheet
            description='Dieser Link gilt nicht mehr. Mit einem Account findest du andere Partys.'
            onCreateAccount={() => router.push('/login?step=signup')}
            onSignIn={() => router.push('/login?step=signin')}
          />
        </>
      )}
      {state.kind === 'party' && (
        <PartyDetail
          partyId={state.id}
          viewer={state.isHost ? 'host' : 'stranger'}
          invite
          onClose={() => router.push('/my-parties')}
          onDeleted={() => router.push('/hosting')}
          onLoaded={(row) => {
            setPin({ id: row.id, lat: row.lat, lng: row.lng, background_url: row.background_url, title: row.title, is_exact: row.is_exact })
            flyTo(row.lng, row.lat)
          }}
        />
      )}
      {/* Without an account nobody can answer: the start screen comes first, in the
          container, as tall as its content. */}
      {state.kind === 'signedOut' && (
        <>
          <FitSheet />
          <AuthSheet
            description='Um an einer Party teilnehmen zu können brauchst du einen Account.'
            next={inviteNext}
            onCreateAccount={() => router.push(`${loginHref}&step=signup`)}
            onSignIn={() => router.push(`${loginHref}&step=signin`)}
          />
        </>
      )}
    </>
  )
}
