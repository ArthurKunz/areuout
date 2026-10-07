'use client'

import { useEffect, useRef, useState } from 'react'
import { UserPlus, X } from 'lucide-react'
import BigButton from '@/components/shared/BigButton'
import IconButton from '@/components/shared/IconButton'
import Spinner from '@/components/shared/Spinner'
import WarningBanner from '@/components/shared/WarningBanner'
import { setRsvp } from '@/features/parties/services/parties.service'
import { getDetailPolls, type DetailPoll } from '@/features/parties/services/pools.service'
import { supabase } from '@/lib/supabase/client'
import type { RsvpStatus } from '@/features/parties/types/parties.types'
import { alertError, isPartyOver } from '@/lib/utils'
import DetailCards, { type DetailPage, type PartyDetailRow } from './DetailCards'
import DetailHeader from './DetailHeader'
import GuestsPage from './GuestsPage'
import HostActions from './HostActions'
import JoinRequestsCard, { type JoinRequest } from './JoinRequestsCard'
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
  // A private party without room for the viewer: `Anfragen` is disabled.
  full: boolean
  // Host only: the open join requests for the card `Anfragen`.
  requests: JoinRequest[]
}

// The party detail container (App Redesign 3.5), built once for every place that opens
// a party: Hosting, My Parties, Explore and the invite page. It replaces the
// list inside the same container, which keeps its height; the header stays and the
// cards scroll. The caller hides the navigation while it is open.
export default function PartyDetail({
  partyId,
  viewer,
  onClose,
  onDeleted,
  onStatusChange,
  onLoaded,
  invite = false,
}: {
  partyId: string
  viewer: Viewer
  // Opened from the invite link (App Redesign 4.3): the link is the invitation, so the
  // bar offers all three answers, also on a private party, instead of Teilnehmen or
  // Anfragen.
  invite?: boolean
  // ✗: the caller shows its list again.
  onClose: () => void
  // Host only: the party is gone; the caller drops it from its list and map.
  onDeleted?: () => void
  // Guest only: the answer changed (or was rolled back); the caller updates its list.
  onStatusChange?: (status: RsvpStatus) => void
  // The party as just loaded: the caller takes over its position, is_exact and my_status,
  // so an accepted request turns the blurred pin exact without reloading the page.
  onLoaded?: (party: PartyDetailRow) => void
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  // The viewer's answer, shared by the RSVP buttons in the header and on the guest list.
  const [myStatus, setMyStatus] = useState<RsvpStatus | null>(null)
  const [joining, setJoining] = useState(false)
  const [requesting, setRequesting] = useState(false)
  // The answer being written from the invite bar: the spinner sits on that button.
  const [answering, setAnswering] = useState<RsvpStatus | null>(null)
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
      viewer === 'host'
        ? supabase.rpc('get_party_join_requests', { p_event_id: partyId })
        : Promise.resolve({ data: null, error: null }),
      supabase.auth.getSession(),
    ]).then(async ([detail, polls, invite, requests, session]) => {
      if (cancelled) return
      const error = detail.error ?? polls.error ?? invite.error ?? requests.error
      if (error || !detail.data) {
        alertError('Die Party konnte nicht geladen werden.', error?.message)
        onClose()
        return
      }
      const party = detail.data
      const userId = session.data.session?.user.id ?? null
      // Only someone who could still ask needs to know whether the party is full; the
      // database's own rule, asked for the viewer's own id (it answers no other). On the
      // invite page that is anyone without an answer, a pending request included.
      let full = false
      const couldAsk = invite ? !isRsvpStatus(party.my_status) : !party.is_public && party.my_status === null
      if (viewer !== 'host' && couldAsk && party.max_guests !== null && userId) {
        const room = await supabase.rpc('party_has_room', { p_event_id: partyId, p_user_id: userId })
        if (cancelled) return
        full = room.data === false
      }
      setMyStatus(isRsvpStatus(party.my_status) ? party.my_status : null)
      setLoaded({
        party,
        polls: polls.data?.polls ?? [],
        questions: polls.data?.questions ?? [],
        inviteCode: invite.data?.invite_code ?? null,
        userId,
        requested: party.my_status === 'requested',
        full,
        requests: requests.data ?? [],
      })
      onLoaded?.(party)
    })
    return () => {
      cancelled = true
    }
    // onClose and onLoaded change identity on every render of the caller; the load
    // depends on the party and the viewer only.
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

  const { party, polls, questions, inviteCode, userId, requested, full, requests } = loaded
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

  // `Anfragen` on a private party (Join Request): request_to_join, then the bar waits.
  // Every refusal comes back as a German sentence from the database.
  const request = async () => {
    if (requesting) return
    setRequesting(true)
    const { error } = await supabase.rpc('request_to_join', { p_event_id: party.id })
    setRequesting(false)
    if (error) {
      alertError('Deine Anfrage konnte nicht gesendet werden.', error.message)
      return
    }
    setLoaded({ ...loaded, requested: true })
  }

  // The invite bar's three answers, through the same upsert as the RSVP button. The first
  // answer makes the viewer a member, so the polls and questions of a private party,
  // empty until now, are read again.
  const answer = async (status: RsvpStatus) => {
    if (answering) return
    setAnswering(status)
    const { error } = await setRsvp(party.id, userId ?? '', status)
    setAnswering(null)
    if (error) {
      alertError('Deine Antwort konnte nicht gespeichert werden.', error.message)
      return
    }
    changeStatus(status)
    void reloadPolls()
  }

  // The round ✗ and ? either side of the invite bar: as tall as the green button.
  const round = 'flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full text-main-white glass-control transition-opacity duration-200 disabled:opacity-40'

  // The bar at the bottom (App Redesign 3.5), only for someone without an answer while
  // the party is not over.
  const bar =
    viewer === 'host' || myStatus || over ? null : invite ? (
      <div className='flex w-full items-center gap-2'>
        <button type='button' onClick={() => answer('not_going')} disabled={answering !== null} aria-label='Absagen' className={`${round} bg-red`}>
          {answering === 'not_going' ? <Spinner /> : <X size={30} strokeWidth={2.5} />}
        </button>
        {/* A full party keeps no seat to take, but maybe and no stay open. */}
        <div className='flex min-w-0 flex-1 [&>button]:max-w-none'>
          <BigButton variant='green' onClick={() => answer('going')} disabled={answering !== null || full}>
            {answering === 'going' ? <Spinner /> : full ? 'Diese Party ist voll' : 'Teilnehmen'}
          </BigButton>
        </div>
        <button type='button' onClick={() => answer('maybe')} disabled={answering !== null} aria-label='Vielleicht' className={`${round} bg-yellow`}>
          {answering === 'maybe' ? <Spinner /> : <span className='text-[30px] font-bold leading-none'>?</span>}
        </button>
      </div>
    ) : party.is_public ? (
      <BigButton variant='green' onClick={join} disabled={joining}>
        Teilnehmen
      </BigButton>
    ) : requested ? (
      <BigButton variant='green' disabled>
        Warten auf Bestätigung
      </BigButton>
    ) : full ? (
      <BigButton variant='green' disabled>
        Diese Party ist voll
      </BigButton>
    ) : (
      <BigButton variant='green' onClick={request} disabled={requesting}>
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
        >
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
        </PageHeader>
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
      >
        {invite && over && (
          <div className='pb-2.5'>
            <WarningBanner message='Diese Party ist vorbei.' />
          </div>
        )}
        <DetailCards
          // Someone's home address: the invite page stops showing it to guests once the
          // party is over, as the old invite page did.
          party={invite && over && viewer !== 'host' ? { ...party, location: '' } : party}
          polls={polls}
          questions={questions}
          userId={userId}
          canAnswer={canAnswer}
          requests={viewer === 'host' && requests.length > 0 ? <JoinRequestsCard partyId={party.id} initial={requests} /> : undefined}
          onPollChange={changePoll}
          onPollSaved={reloadPolls}
          onOpen={setPage}
        />
      </DetailHeader>
      {bar && <div className='flex shrink-0 justify-center px-5 pt-3 pb-5'>{bar}</div>}
    </div>
  )
}
