'use client'

import { useEffect, useRef, useState } from 'react'
import { UserPlus, X } from 'lucide-react'
import BigButton from '@/components/shared/BigButton'
import IconButton from '@/components/shared/IconButton'
import { setRsvp } from '@/features/parties/services/parties.service'
import { getDetailPolls, type DetailPoll } from '@/features/parties/services/pools.service'
import { supabase } from '@/lib/supabase/client'
import type { RsvpStatus } from '@/features/parties/types/parties.types'
import { alertError, isPartyOver } from '@/lib/utils'
import DetailCards, { type DetailPage, type PartyDetailRow } from './DetailCards'
import DetailHeader from './DetailHeader'
import GuestsPage from './GuestsPage'
import HostActions from './HostActions'
import PageHeader from './PageHeader'
import PollPage from './PollPage'
import QuestionPage from './QuestionPage'
import RsvpControl from './RsvpControl'

// Who is looking. 'host' gets ⋯ and share; get_party_detail and get_party_poll_data
// already decide what each viewer may see. Everyone else gets the RSVP button once
// my_status holds an answer, and ✗ alone with the bar at the bottom until then.
export type Viewer = 'host' | 'guest' | 'stranger'

const RSVP_STATUSES: readonly string[] = ['going', 'maybe', 'not_going'] satisfies RsvpStatus[]
export const isRsvpStatus = (status: string | null): status is RsvpStatus =>
  status !== null && RSVP_STATUSES.includes(status)

type Loaded = {
  party: PartyDetailRow
  polls: DetailPoll[]
  questions: DetailPoll[]
  inviteCode: string | null
  userId: string | null
  // A join request is pending (my_status 'requested'): no answer yet, the bar waits.
  requested: boolean
}

// The party detail container (App Redesign 3.5), built once for every place that opens
// a party: Hosting, My Parties and Explore now; the invite page later. It replaces the
// list inside the same container, which keeps its height; the header stays and the
// cards scroll. The caller hides the navigation while it is open.
export default function PartyDetail({
  partyId,
  viewer,
  onClose,
  onDeleted,
  onStatusChange,
}: {
  partyId: string
  viewer: Viewer
  // ✗: the caller shows its list again.
  onClose: () => void
  // Host only: the party is gone; the caller drops it from its list and map.
  onDeleted?: () => void
  // Guest only: the answer changed (or was rolled back); the caller updates its list.
  onStatusChange?: (status: RsvpStatus) => void
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  // The viewer's answer, shared by the RSVP buttons in the header and on the guest list.
  const [myStatus, setMyStatus] = useState<RsvpStatus | null>(null)
  const [joining, setJoining] = useState(false)
  const [page, setPage] = useState<DetailPage | null>(null)
  // Bumped by every vote and answer: a re-read that started before the latest one would
  // otherwise overwrite what the viewer just tapped.
  const pollVersion = useRef(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.rpc('get_party_detail', { p_event_id: partyId }).maybeSingle(),
      getDetailPolls(partyId),
      // No function returns the invite code: only the host reads it, from the row.
      viewer === 'host'
        ? supabase.from('events').select('invite_code').eq('id', partyId).single()
        : Promise.resolve({ data: null, error: null }),
      supabase.auth.getSession(),
    ]).then(([detail, polls, invite, session]) => {
      if (cancelled) return
      const error = detail.error ?? polls.error ?? invite.error
      if (error || !detail.data) {
        alertError('Die Party konnte nicht geladen werden.', error?.message)
        onClose()
        return
      }
      setMyStatus(isRsvpStatus(detail.data.my_status) ? detail.data.my_status : null)
      setLoaded({
        party: detail.data,
        polls: polls.data?.polls ?? [],
        questions: polls.data?.questions ?? [],
        inviteCode: invite.data?.invite_code ?? null,
        userId: session.data.session?.user.id ?? null,
        requested: detail.data.my_status === 'requested',
      })
    })
    return () => {
      cancelled = true
    }
    // onClose changes identity on every render of the caller; the load depends on the
    // party and the viewer only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId, viewer])

  if (!loaded) {
    return (
      <div className='flex min-h-0 flex-1 flex-col'>
        <div className='flex shrink-0 items-start justify-between gap-3 px-5'>
          <div className='flex flex-col gap-2 pt-1'>
            <div className='h-6 w-40 rounded-full skeleton' />
            <div className='h-3.5 w-24 rounded-full skeleton' />
          </div>
          <IconButton icon={X} label='Schließen' onClick={onClose} />
        </div>
        <div className='grid grid-cols-2 gap-2.5 px-5 pt-4'>
          <div className='h-28 rounded-[25px] skeleton' />
          <div className='h-28 rounded-[25px] skeleton' />
          <div className='col-span-2 h-28 rounded-[25px] skeleton' />
        </div>
      </div>
    )
  }

  const { party, polls, questions, inviteCode, userId, requested } = loaded
  const hostName = `${party.host_firstname} ${party.host_lastname}`
  // The host votes and answers in their own party (Polls.md, Question.md); everyone
  // else needs an answer to the party first.
  const canAnswer = viewer === 'host' || myStatus !== null

  const changeStatus = (status: RsvpStatus) => {
    setMyStatus(status)
    onStatusChange?.(status)
  }

  // The vote or answer shows at once; PollOptions and AnswerRow put the old poll back
  // here if their write fails.
  const changePoll = (next: DetailPoll) => {
    pollVersion.current += 1
    const swap = (list: DetailPoll[]) => list.map((poll) => (poll.pool_id === next.pool_id ? next : poll))
    setLoaded((current) => current && { ...current, polls: swap(current.polls), questions: swap(current.questions) })
  }

  // After a write: everyone's votes and answers again, with the names and pictures the
  // optimistic entry could not know. A failed re-read leaves what is shown.
  const reloadPolls = async () => {
    const version = pollVersion.current
    const { data } = await getDetailPolls(party.id)
    if (!data || version !== pollVersion.current) return
    setLoaded((current) => current && { ...current, polls: data.polls, questions: data.questions })
  }

  const over = isPartyOver(party.event_date, party.ends_at)

  // From the data, not the caller: whoever has an answer gets the RSVP button, so a
  // stranger who just tapped Teilnehmen turns into a guest in place.
  const rsvp = viewer !== 'host' && myStatus && (
    <RsvpControl partyId={party.id} initialStatus={myStatus} over={over} onStatusChange={changeStatus} />
  )

  // `Teilnehmen` on a public party: one tap is `zugesagt`, through the same upsert as the
  // RSVP button. A full party refuses it in the database (`Diese Party ist voll.`).
  const join = async () => {
    if (joining) return
    setJoining(true)
    const { error } = await setRsvp(party.id, userId ?? '', 'going')
    setJoining(false)
    if (error) {
      alertError('Deine Antwort konnte nicht gespeichert werden.', error.message)
      return
    }
    changeStatus('going')
  }

  // The bar at the bottom (App Redesign 3.5), only for someone without an answer while
  // the party is not over. `Anfragen` does nothing yet (step 8).
  const bar =
    viewer === 'host' || myStatus || over ? null : party.is_public ? (
      <BigButton variant='green' onClick={join} disabled={joining}>
        Teilnehmen
      </BigButton>
    ) : requested ? (
      <BigButton variant='green' disabled>
        Warten auf Bestätigung
      </BigButton>
    ) : (
      <BigButton variant='green'>
        <span className='flex items-center gap-2'>
          <UserPlus size={20} />
          Anfragen
        </span>
      </BigButton>
    )

  if (page) {
    const poll = page.kind === 'poll' ? polls.find((item) => item.pool_id === page.id) : undefined
    const question = page.kind === 'question' ? questions.find((item) => item.pool_id === page.id) : undefined
    return (
      <div className='flex min-h-0 flex-1 flex-col'>
        <PageHeader
          title={page.kind === 'guests' ? 'Teilnehmer' : page.kind === 'poll' ? 'Umfrage' : 'Frage'}
          actions={page.kind === 'guests' ? rsvp : undefined}
          onBack={() => setPage(null)}
        />
        <div className='min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-5'>
          {page.kind === 'guests' && (
            <GuestsPage
              partyId={party.id}
              maxGuests={party.max_guests}
              userId={userId}
              myStatus={myStatus}
              canRemove={viewer === 'host'}
            />
          )}
          {poll && <PollPage poll={poll} />}
          {question && <QuestionPage question={question} hostName={hostName} userId={userId} />}
        </div>
      </div>
    )
  }

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <DetailHeader
        title={party.title}
        hostName={hostName}
        isPublic={party.is_public}
        onClose={onClose}
        actions={
          viewer === 'host' && inviteCode ? (
            <HostActions
              partyId={party.id}
              hostId={party.host_id}
              title={party.title}
              inviteCode={inviteCode}
              onInviteCode={(code) => setLoaded({ ...loaded, inviteCode: code })}
              onDeleted={() => onDeleted?.()}
            />
          ) : (
            rsvp || undefined
          )
        }
      />
      <div className='min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-5'>
        <DetailCards
          party={party}
          polls={polls}
          questions={questions}
          userId={userId}
          canAnswer={canAnswer}
          onPollChange={changePoll}
          onPollSaved={reloadPolls}
          onOpen={setPage}
        />
      </div>
      {bar && <div className='flex shrink-0 justify-center px-5 pt-3 pb-5'>{bar}</div>}
    </div>
  )
}
