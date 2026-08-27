'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronLeft, Copy, MoreHorizontal, SquarePen, Trash2, UsersRound, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { alertError, getOrigin, isPartyOver } from '@/lib/utils'
import { getMyProfile, type Profile } from '@/features/profile/services/profile.service'
import {
  getPartyByInviteCode,
  getPartyAttendeesByInviteCode,
  getPartyHostByInviteCode,
  getMyRsvpStatus,
  setRsvp,
  deleteParty,
  deleteRsvp,
  getRsvpCountsByStatusByInviteCode,
} from './services/parties.service'
import { getPartyPoolsByInviteCode } from './services/pools.service'
import Avatar from '@/components/shared/Avatar'
import Spinner from '@/components/shared/Spinner'
import WarningBanner from '@/components/shared/WarningBanner'
import Section from './components/Section'
import AuthSheet from '@/features/auth/components/AuthSheet'
import CapacityWarning, { isFull, isNearlyFull } from './components/CapacityWarning'
import PartyDescription from './components/PartyDescription'
import PoolsSection from './components/PoolsSection'
import AttendeeList from './components/AttendeeList'
import PartyMap from './components/PartyMap'
import type { PartyDetail, Attendee, PartyHost, RsvpStatus, Pool } from './types/parties.types'

const BackIcon = <ChevronLeft size={24} strokeWidth={3} className='text-white' />

const CopyIcon = <Copy size={15} strokeWidth={2} className='text-heading' />

const MoreIcon = <MoreHorizontal size={20} strokeWidth={2.5} className='text-heading' />

const TrashIcon = <Trash2 size={20} strokeWidth={2.5} className='text-warning' />

const EditIcon = <SquarePen size={20} strokeWidth={2.5} className='text-label-large' />

const GuestsIcon = <UsersRound size={20} strokeWidth={2.5} className='text-label-large' />

const CheckIcon = <Check size={18} strokeWidth={3} className='text-heading' />

const CrossIcon = <X size={22} strokeWidth={3.5} className='text-warning' />

const RSVP_MENU: { status: RsvpStatus; label: string; icon: string }[] = [
  { status: 'going', label: 'zugesagt', icon: '✅' },
  { status: 'maybe', label: 'vielleicht', icon: '🤔' },
  { status: 'not_going', label: 'abgesagt', icon: '❌' },
]

const iconButtonClass = 'h-11.25 w-11.25 bg-main/50 rounded-full flex justify-center items-center backdrop-blur-xl'

// The ••• button and the menu are ONE element: closed it is the 45px circle, open
// it grows into the panel from the same top-right corner.
const MENU_CLOSED_SIZE = 45

// The radius is CONSTANT at half the closed size, so the circle is a real circle and
// the open panel keeps the same corners — animating rounded-full (9999px) to a small
// radius looks like a pop, because the corner only stops being a semicircle in the
// last frames, once the value drops under half the height.
const menuContainerClass =
  'absolute right-0 top-0 z-20 overflow-hidden rounded-[22.5px] bg-main/50 backdrop-blur-xl transition-[width,height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]'

export default function InviteScreen({ inviteCode }: { inviteCode: string }) {
  const router = useRouter()
  const [party, setParty] = useState<PartyDetail | null>(null)
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [host, setHost] = useState<PartyHost | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [counts, setCounts] = useState({ going: 0, maybe: 0, not_going: 0 })
  const [copied, setCopied] = useState(false)
  // The status being written, not just a flag: the spinner has to sit on the
  // button that was tapped, and all of them are disabled while one is running.
  const [pendingRsvp, setPendingRsvp] = useState<RsvpStatus | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuHeight, setMenuHeight] = useState(MENU_CLOSED_SIZE)
  const menuContentRef = useRef<HTMLDivElement>(null)
  const [pools, setPools] = useState<Pool[]>([])
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [heroLoaded, setHeroLoaded] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [openSections, setOpenSections] = useState({ location: true, polls: true, guests: true })

  // One flag per block, so every section clears its own skeleton the moment its data lands.
  const [partyLoading, setPartyLoading] = useState(true)
  const [countsLoading, setCountsLoading] = useState(true)
  const [poolsLoading, setPoolsLoading] = useState(true)
  const [attendeesLoading, setAttendeesLoading] = useState(true)

  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))

  // The gate only goes up once we know there is no session — otherwise it would
  // flash over the skeletons on every load.
  const showAuthGate = !partyLoading && !userId

  // Signing up from an invite has to come back to that invite, not to the parties list.
  const inviteNext = `/e/${inviteCode}`
  const loginHref = `/login?next=${encodeURIComponent(inviteNext)}`

  // An invite link outlives the party it points at — it sits in a WhatsApp thread for
  // ever. Without this the page went on looking like an upcoming party months later,
  // handing out the address and still taking answers.
  const partyOver = !!party && isPartyOver(party.event_date, party.ends_at)

  // A signed-in guest who has not answered yet must answer first: the header
  // controls are hidden and the three RSVP buttons take over the bottom.
  // Not once the party is over: there is nothing left to answer.
  const showRsvpGate = !partyLoading && !!userId && !isHost && rsvpStatus === null && !partyOver

  // While the party is loading we do not yet know whether this is the host, a
  // guest or someone without an account, so the header stays completely empty.
  const showHeaderControls = !partyLoading && !showAuthGate && !showRsvpGate

  // The counts land a moment after the party itself, and until they do we must not
  // claim the party is full — that would blink the zusagen button away and back.
  const full = !countsLoading && isFull(counts.going, party?.max_guests ?? null)

  // Who the capacity banner is FOR: the host, who is planning around it, and guests
  // holding no seat. Someone who already said yes has their place and does not need
  // to be told the party is full; someone who has not answered at all gets the same
  // message down at the RSVP row instead, where their decision actually happens.
  const showCapacityNotice = isHost || rsvpStatus === 'maybe' || rsvpStatus === 'not_going'

  // You cannot take a seat that is gone — unless you are the one already sitting in it.
  const seatBlocked = full && rsvpStatus !== 'going'

  // Clipping the page container is not enough: the document itself stays
  // scrollable, and mobile Safari scrolls it right through a fixed overlay.
  useEffect(() => {
    if (!showAuthGate) return
    const { body, documentElement: html } = document
    const previous = { body: body.style.overflow, html: html.style.overflow }
    body.style.overflow = 'hidden'
    html.style.overflow = 'hidden'
    return () => {
      body.style.overflow = previous.body
      html.style.overflow = previous.html
    }
  }, [showAuthGate])

  useEffect(() => {
    let cancelled = false

    // The invite code has to resolve to an party before anything else can be fetched,
    // so this is one await followed by the same parallel block the detail page uses.
    async function load() {
      const partyData = await getPartyByInviteCode(inviteCode)
      if (cancelled) return
      if (!partyData) {
        setNotFound(true)
        setPartyLoading(false)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      const uid = session?.user.id ?? null
      setUserId(uid)
      setParty(partyData)
      setIsHost(partyData.host_id === uid)

      void Promise.all([
        getPartyHostByInviteCode(inviteCode),
        uid ? getMyRsvpStatus(partyData.id, uid) : Promise.resolve(null),
      ]).then(([hostData, status]) => {
        if (cancelled) return
        setHost(hostData)
        setRsvpStatus(status)
        setPartyLoading(false)
      })

      void getRsvpCountsByStatusByInviteCode(inviteCode).then((data) => {
        if (cancelled) return
        setCounts(data)
        setCountsLoading(false)
      })

      void getPartyAttendeesByInviteCode(inviteCode).then((data) => {
        if (cancelled) return
        setAttendees(data)
        setAttendeesLoading(false)
      })

      void getPartyPoolsByInviteCode(inviteCode, partyData.id).then((data) => {
        if (cancelled) return
        setPools(data)
        setPoolsLoading(false)
      })

      // Needed so my own avatar can be rendered optimistically when I vote in a poll.
      if (uid) {
        void getMyProfile(uid).then((data) => {
          if (!cancelled) setMyProfile(data)
        })
      }
    }

    void load()

    return () => { cancelled = true }
  }, [inviteCode])

  const refreshPools = () => {
    if (!party) return
    void getPartyPoolsByInviteCode(inviteCode, party.id).then(setPools)
  }

  // Measured on open (the rows are static, so this is read lazily rather than watched)
  // because an explicit px height animates evenly — a min-height would hold the box at
  // 45px for the first part of the growth and only then start moving.
  const openMenu = () => {
    setMenuHeight(menuContentRef.current?.scrollHeight ?? MENU_CLOSED_SIZE)
    setMenuOpen(true)
  }

  const handleCopy = async () => {
    if (!party) return
    await navigator.clipboard.writeText(`${getOrigin()}/e/${party.invite_code}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDeleteParty = async () => {
    if (!party) return
    if (!confirm('Party wirklich löschen? Das kann nicht rückgängig gemacht werden.')) return
    setDeleting(true)
    const { error } = await deleteParty(party.id, party.host_id)
    if (error) {
      setDeleting(false)
      setMenuOpen(false)
      alertError('Party konnte nicht gelöscht werden.', error.message)
      return
    }
    router.push('/parties')
  }

  const handleLeaveParty = async () => {
    if (!party || !userId) return
    if (!confirm('Party für dich löschen? Du kannst über den Einladungslink jederzeit wieder beitreten.')) return
    setDeleting(true)
    const { error } = await deleteRsvp(party.id, userId)
    if (error) {
      setDeleting(false)
      setMenuOpen(false)
      alertError('Du konntest nicht aus der Party entfernt werden.', error.message)
      return
    }
    router.push('/parties')
  }

  const handleRsvp = async (status: RsvpStatus) => {
    if (!party) return
    // Anonymous visitors have to sign up before they can answer.
    if (!userId) { router.push(loginHref); return }
    setPendingRsvp(status)
    const { error } = await setRsvp(party.id, userId, status)
    if (error) {
      alertError('Deine Antwort konnte nicht gespeichert werden.', error.message)
      setPendingRsvp(null)
      return
    }
    const oldStatus = rsvpStatus
    setCounts(prev => {
      const next = { ...prev }
      if (oldStatus === 'going') next.going = Math.max(0, next.going - 1)
      else if (oldStatus === 'maybe') next.maybe = Math.max(0, next.maybe - 1)
      else if (oldStatus === 'not_going') next.not_going = Math.max(0, next.not_going - 1)
      if (status === 'going') next.going++
      else if (status === 'maybe') next.maybe++
      else next.not_going++
      return next
    })
    setRsvpStatus(status)
    setPendingRsvp(null)
    // Poll answers are only readable once you belong to the party, and this very
    // click is what made that true — the copy in state was fetched a moment ago,
    // when the answer was still none of this visitor's business, so it came back
    // empty. Without this refetch the polls would sit there answerless until a reload.
    if (oldStatus === null) refreshPools()
    // Hold the menu open briefly so the ✓ visibly lands on the row that was tapped.
    setTimeout(() => setMenuOpen(false), 600)
  }

  if (notFound) {
    return (
      <div className='relative w-full min-h-dvh flex items-center justify-center bg-main'>
        <span className='text-label-1 text-label-small'>Diese Party existiert nicht (mehr).</span>
      </div>
    )
  }

  const statsLoading = partyLoading || countsLoading

  const stats: { label: string; value: string; warn?: boolean }[] = party
    ? [
        {
          label: 'Datum',
          value: new Date(party.event_date).toLocaleDateString('de-DE', {
            day: '2-digit', month: '2-digit', year: '2-digit',
          }),
        },
        {
          label: 'Uhrzeit',
          value: new Date(party.event_date).toLocaleTimeString('de-DE', {
            hour: '2-digit', minute: '2-digit',
          }) + ' Uhr',
        },
        // Occupancy, not just the cap: "10/50" reads as zugesagt out of max.
        ...(party.max_guests != null
          ? [{
              label: 'Max. Gäste',
              value: `${counts.going}/${party.max_guests}`,
              warn: isNearlyFull(counts.going, party.max_guests),
            }]
          : []),
        { label: 'zugesagt', value: String(counts.going) },
        { label: 'vielleicht', value: String(counts.maybe) },
        { label: 'abgesagt', value: String(counts.not_going) },
      ]
    : []

  const locationCommaIndex = party ? party.location.lastIndexOf(',') : -1
  const address = !party ? '' : locationCommaIndex === -1 ? party.location : party.location.slice(0, locationCommaIndex).trim()
  const city = !party || locationCommaIndex === -1 ? '' : party.location.slice(locationCommaIndex + 1).trim()

  return (
    <div className={`relative w-full bg-main ${showAuthGate ? 'h-dvh overflow-hidden' : ''}`}>

      <div className='relative w-full h-100 overflow-hidden'>
        {party?.background_url ? (
          <>
            <img
              src={party.background_url}
              alt=''
              onLoad={() => setHeroLoaded(true)}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
                heroLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
            {!heroLoaded && <div className='absolute inset-0 skeleton' />}
          </>
        ) : partyLoading ? (
          <div className='absolute inset-0 skeleton' />
        ) : (
          <div className='absolute inset-0 bg-secondary backdrop-blur-xl' />
        )}
        <div className='absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-main to-transparent pointer-events-none' />

        <div className='relative z-10 px-4 py-7.5'>
          <div className='relative w-full h-10'>
            {/* Nothing at all until we know who is looking: no back button, no
                skeleton placeholder. The controls only appear once the role is
                known AND neither gate is up. */}
            {showHeaderControls && (
              <button
                onClick={() => router.push('/parties')}
                aria-label='Zurück'
                className={`absolute left-0 top-0 ${iconButtonClass}`}
              >
                {BackIcon}
              </button>
            )}

            {/* The host owns this link, so they get the copy button — to the left of the
                ••• , and out of the way while the panel expands over that spot. */}
            {showHeaderControls && isHost && (
              <button
                onClick={handleCopy}
                aria-label='Link kopieren'
                aria-hidden={menuOpen}
                tabIndex={menuOpen ? -1 : 0}
                className={`absolute right-13.75 top-0 ${iconButtonClass} transition-opacity duration-150 ${
                  menuOpen ? 'pointer-events-none opacity-0' : 'opacity-100 delay-150'
                }`}
              >
                {copied ? <span className='text-label-1 text-heading'>✓</span> : CopyIcon}
              </button>
            )}

            {showHeaderControls && (
              <>
                {menuOpen && <div className='fixed inset-0 z-10' onClick={() => setMenuOpen(false)} />}

                <div
                  style={{ height: menuOpen ? menuHeight : MENU_CLOSED_SIZE }}
                  className={`${menuContainerClass} ${menuOpen ? 'w-56.25' : 'w-11.25'}`}
                >
                  {/* No blur of its own: the panel above already blurs, and a second
                      pass re-samples that tinted backdrop into a darker circle —
                      visible in the corner for the 150ms this button fades out. */}
                  <button
                    onClick={openMenu}
                    aria-label='Mehr Optionen'
                    aria-expanded={menuOpen}
                    aria-hidden={menuOpen}
                    tabIndex={menuOpen ? -1 : 0}
                    className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150 ${
                      menuOpen ? 'pointer-events-none opacity-0' : 'opacity-100 delay-150'
                    }`}
                  >
                    {MoreIcon}
                  </button>

                  {/* Fixed width, so the labels never reflow while the box is still narrow. */}
                  <div
                    ref={menuContentRef}
                    aria-hidden={!menuOpen}
                    className={`w-56.25 p-2 flex flex-col transition-opacity duration-150 ${
                      menuOpen ? 'opacity-100 delay-150' : 'pointer-events-none opacity-0'
                    }`}
                  >
                    {/* The host cannot RSVP to their own party — they only get the delete row.
                        Nobody can answer a party that has already happened. */}
                    {!isHost && !partyOver &&
                      RSVP_MENU.map(({ status, label, icon }) => {
                        // Only 'zugesagt' costs a place, so it is the only row a full
                        // party takes away. Saying maybe or no stays open either way.
                        const blocked = seatBlocked && status === 'going'
                        return (
                        <button
                          key={status}
                          type='button'
                          onClick={() => handleRsvp(status)}
                          disabled={pendingRsvp !== null || blocked}
                          className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-full text-left ${
                            rsvpStatus === status ? 'bg-tertiary' : ''
                          } ${blocked ? 'opacity-40' : ''}`}
                        >
                          <span className='w-5 h-5 flex items-center justify-center text-md text-label-large'>
                            {pendingRsvp === status ? <Spinner size={16} /> : icon}
                          </span>
                          <span className='text-label-1 text-label-large'>{label}</span>
                          {rsvpStatus === status && <span className='ml-auto flex items-center'>{CheckIcon}</span>}
                        </button>
                        )
                      })}

                    {/* The host's own controls. Plain rows like every other one —
                        nothing here is special enough to be highlighted. */}
                    {isHost && (
                      <>
                        <button
                          type='button'
                          onClick={() => router.push(`/parties/${party?.id}/edit`)}
                          className='flex items-center gap-3 w-full px-4 py-2.5 rounded-full text-left'
                        >
                          <span className='w-5 h-5 flex items-center justify-center'>{EditIcon}</span>
                          <span className='text-label-1 text-label-large'>Bearbeiten</span>
                        </button>

                        <button
                          type='button'
                          onClick={() => router.push(`/parties/${party?.id}/guests`)}
                          className='flex items-center gap-3 w-full px-4 py-2.5 rounded-full text-left'
                        >
                          <span className='w-5 h-5 flex items-center justify-center'>{GuestsIcon}</span>
                          <span className='text-label-1 text-label-large'>Gäste verwalten</span>
                        </button>
                      </>
                    )}

                    {/* A guest has nothing to leave until they have actually answered.
                        The divider is unconditional now: the host has rows above it too. */}
                    {(isHost || rsvpStatus !== null) && (
                      <>
                        <div className='h-0.25 w-full bg-divider my-2' />
                        <button
                          type='button'
                          onClick={isHost ? handleDeleteParty : handleLeaveParty}
                          disabled={deleting}
                          className='flex items-center gap-3.25 w-full px-4 py-3'
                        >
                          <span className='w-5 h-5 flex items-center justify-center text-warning'>
                            {deleting ? <Spinner size={16} /> : TrashIcon}
                          </span>
                          <span className='text-label-1 font-semibold text-warning'>Löschen</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className={`relative px-4 bg-main flex flex-col gap-12.5 ${showRsvpGate ? 'pb-safe-rsvp-content' : 'pb-7.5'}`}>

        {partyOver && <WarningBanner message='Diese Party ist vorbei.' />}

        <div className='w-full flex flex-col gap-5'>
          {partyLoading ? (
            <div className='w-full flex flex-col gap-3'>
              <div className='w-full flex flex-col gap-2'>
                <div className='h-9 w-3/4 rounded-lg skeleton' />
                <div className='flex items-center gap-2'>
                  <div className='w-6.25 h-6.25 rounded-full skeleton' />
                  <div className='h-3.5 w-32 rounded-full skeleton' />
                </div>
              </div>
              <div className='flex flex-col gap-1.5'>
                <div className='h-3 w-full rounded-full skeleton' />
                <div className='h-3 w-5/6 rounded-full skeleton' />
              </div>
            </div>
          ) : (
            <div className='w-full flex flex-col gap-3'>
              <div className='w-full flex flex-col'>
                <span className='text-heading-1 font-semibold text-heading'>{party?.title}</span>
                <div className='flex items-center gap-2'>
                  <Avatar
                    size={25}
                    url={host?.avatar_url ?? null}
                    color={host?.avatar_color ?? null}
                    firstname={host?.firstname ?? null}
                    lastname={host?.lastname ?? null}
                  />
                  <span className='text-[14px] text-label-large'>
                    {[host?.firstname, host?.lastname].filter(Boolean).join(' ') || 'Unbekannt'}
                  </span>
                </div>
              </div>
              {party?.description && <PartyDescription text={party.description} />}
            </div>
          )}

          <div className='w-full h-0.25 bg-divider-subtle'/>

          <div className='w-full overflow-x-auto scroll-smooth scrollbar-none [-webkit-overflow-scrolling:touch]'>
            {statsLoading ? (
              <div className='flex w-max gap-6'>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className='flex flex-col gap-1'>
                    <div className='h-3 w-14 rounded-full skeleton' />
                    <div className='h-3.5 w-10 rounded-full skeleton' />
                  </div>
                ))}
              </div>
            ) : (
              <div className='flex w-max gap-6'>
                {stats.map((stat) => (
                  <div key={stat.label} className='flex flex-col gap-1'>
                    <span className='text-label-2 font-medium text-label-small'>{stat.label}</span>
                    <span className={`text-label-1 font-semibold ${stat.warn ? 'text-warning' : 'text-label-large'}`}>
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!statsLoading && showCapacityNotice && (
            <CapacityWarning going={counts.going} maxGuests={party?.max_guests ?? null} />
          )}
        </div>

        <div className='relative flex flex-col gap-5'>
          {/* Somebody's home address, so it stops being handed out once the party is
              over. The host keeps seeing their own. */}
          {(!partyOver || isHost) && (
          <Section title='Location' open={openSections.location} onToggle={() => toggleSection('location')}>
            {partyLoading || !party ? (
              <div className='w-full pb-7.5'>
                <div className='h-33 w-full rounded-2xl skeleton' />
                <div className='flex flex-col gap-1.5 mt-2'>
                  <div className='h-3.5 w-48 rounded-full skeleton' />
                  <div className='h-3 w-24 rounded-full skeleton' />
                </div>
              </div>
            ) : (
              <div className='w-full pb-7.5'>
                <PartyMap location={party.location} />
                <div className='flex flex-col mt-2'>
                  <span className='truncate font-md text-label-1 text-label-large'>{address}</span>
                  <span className='truncate text-label-2 text-label-small'>{city && `in ${city}`}</span>
                </div>
              </div>
            )}
          </Section>
          )}

          {/* Voting needs an account, so anonymous visitors do not get this section at all. */}
          {poolsLoading && userId ? (
            <Section title='Umfragen' open={openSections.polls} onToggle={() => toggleSection('polls')}>
              <div className='flex flex-col gap-4 pb-7.5'>
                <div className='h-4 w-2/3 rounded-full skeleton' />
                {[0, 1, 2].map((i) => (
                  <div key={i} className='h-12.5 w-full rounded-full skeleton' />
                ))}
              </div>
            </Section>
          ) : pools.length > 0 && userId ? (
            <Section title='Umfragen' open={openSections.polls} onToggle={() => toggleSection('polls')}>
              <div className='pb-7.5'>
                <PoolsSection
                  pools={pools}
                  userId={userId}
                  myProfile={myProfile}
                  onRefresh={refreshPools}
                />
              </div>
            </Section>
          ) : null}

          {attendeesLoading ? (
            <Section title='Gäste' open={openSections.guests} onToggle={() => toggleSection('guests')}>
              <div className='flex flex-col'>
                {[0, 1, 2].map((i) => (
                  <div key={i} className='flex items-center gap-3 py-3'>
                    <div className='h-12.5 w-12.5 shrink-0 rounded-full skeleton' />
                    <div className='min-w-0 flex-1 flex flex-col gap-1.5'>
                      <div className='h-3.5 w-32 rounded-full skeleton' />
                      <div className='h-3 w-20 rounded-full skeleton' />
                    </div>
                    <div className='h-7.5 w-24 rounded-full skeleton' />
                  </div>
                ))}
              </div>
            </Section>
          ) : attendees.length > 0 ? (
            <Section title='Gäste' open={openSections.guests} onToggle={() => toggleSection('guests')}>
              <AttendeeList attendees={attendees} />
            </Section>
          ) : null}
        </div>

      </div>

      {showRsvpGate && (
        // A column now, not a row: when the party is full the notice sits directly
        // above the buttons it explains, in the same fixed block, so the answer and
        // the reason for it are read as one thing. The two round buttons keep their
        // places either side of where the zusagen pill was, so nothing jumps.
        <div className='fixed inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 px-4 pb-safe-rsvp'>
          {full && <WarningBanner message='Keine Plätze mehr frei.' />}

          {full ? (
            /* With zusagen gone the row would be two lonely circles under a full-width
               banner. Instead the two remaining answers split that same width in half
               and take the label the green pill used to carry — so the block reads as
               one piece, and each answer says what it does instead of relying on a
               symbol. Emoji rather than the lucide cross, to match the ✅ zusagen wore
               and the ❌ the ••• menu already uses for the same answer. */
            <div className='flex w-full items-center gap-3'>
              <button
                type='button'
                onClick={() => handleRsvp('not_going')}
                disabled={pendingRsvp !== null}
                className='h-12.5 flex-1 flex items-center justify-center gap-2 rounded-full border border-warning/60 bg-warning/15 backdrop-blur-xl text-subheading-1 font-semibold text-warning disabled:opacity-50'
              >
                {pendingRsvp === 'not_going' ? <Spinner /> : <><span>❌</span>absagen</>}
              </button>

              <button
                type='button'
                onClick={() => handleRsvp('maybe')}
                disabled={pendingRsvp !== null}
                className='h-12.5 flex-1 flex items-center justify-center gap-2 rounded-full border border-maybe/60 bg-maybe/15 backdrop-blur-xl text-subheading-1 font-semibold text-maybe disabled:opacity-50'
              >
                {pendingRsvp === 'maybe' ? <Spinner /> : <><span>🤔</span>vielleicht</>}
              </button>
            </div>
          ) : (
            <div className='flex items-center justify-center gap-3'>
              <button
                type='button'
                onClick={() => handleRsvp('not_going')}
                disabled={pendingRsvp !== null}
                aria-label='Absagen'
                className='h-12.5 w-12.5 shrink-0 flex items-center justify-center rounded-full border border-warning/60 bg-warning/15 text-warning backdrop-blur-xl disabled:opacity-50'
              >
                {pendingRsvp === 'not_going' ? <Spinner /> : CrossIcon}
              </button>

              <button
                type='button'
                onClick={() => handleRsvp('going')}
                disabled={pendingRsvp !== null}
                className='h-12.5 flex items-center justify-center gap-2 rounded-full border border-success/60 bg-success/15 px-6 backdrop-blur-xl text-subheading-1 font-semibold text-success disabled:opacity-50'
              >
                {pendingRsvp === 'going' ? <Spinner /> : <><span>✅</span>zusagen</>}
              </button>

              <button
                type='button'
                onClick={() => handleRsvp('maybe')}
                disabled={pendingRsvp !== null}
                aria-label='Vielleicht'
                className='h-12.5 w-12.5 shrink-0 flex items-center justify-center rounded-full border border-maybe/60 bg-maybe/15 text-maybe backdrop-blur-xl text-subheading-1 disabled:opacity-50'
              >
                {pendingRsvp === 'maybe' ? <Spinner /> : '🤔'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Anonymous visitors see the party through a blur, but cannot act on it without an account. */}
      {showAuthGate && (
        <>
          <div className='fixed inset-0 z-30 touch-none overscroll-none bg-main/30 backdrop-blur-xl' />

          <AuthSheet
            description='Um an einer Party teilnehmen zu können brauchst du einen Account.'
            next={inviteNext}
            onCreateAccount={() => router.push(`${loginHref}&step=signup`)}
            onSignIn={() => router.push(`${loginHref}&step=signin`)}
          />
        </>
      )}
    </div>
  )
}
