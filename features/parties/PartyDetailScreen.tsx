'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronLeft, Copy, MoreHorizontal, RotateCcw, SquarePen, Trash2, UsersRound } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { alertError, generateInviteCode, getOrigin, isPartyOver } from '@/lib/utils'
import { getMyProfile, type Profile } from '@/features/profile/services/profile.service'
import {
  getPartyById,
  getPartyAttendees,
  getPartyHost,
  getMyRsvpStatus,
  setRsvp,
  deleteParty,
  deleteRsvp,
  getRsvpCountsByStatus,
  updateParty,
} from './services/parties.service'
import { getPartyPools } from './services/pools.service'
import Avatar from '@/components/shared/Avatar'
import Spinner from '@/components/shared/Spinner'
import Section from './components/Section'
import CapacityWarning, { isFull, isNearlyFull } from './components/CapacityWarning'
import PartyDescription from './components/PartyDescription'
import PoolsSection from './components/PoolsSection'
import AttendeeList from './components/AttendeeList'
import PartyMap from './components/PartyMap'
import WarningBanner from '@/components/shared/WarningBanner'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import InviteLinkCard from '@/components/shared/InviteLinkCard'
import { primaryButtonClass } from '@/components/shared/Card'
import type { PartyDetail, Attendee, PartyHost, RsvpStatus, Pool } from './types/parties.types'

const BackIcon = <ChevronLeft size={24} strokeWidth={3} className='text-white' />

const CopyIcon = <Copy size={15} strokeWidth={2} className='text-heading' />

const MoreIcon = <MoreHorizontal size={20} strokeWidth={2.5} className='text-heading' />

const TrashIcon = <Trash2 size={20} strokeWidth={2.5} className='text-warning' />

const EditIcon = <SquarePen size={20} strokeWidth={2.5} className='text-label-large' />

const GuestsIcon = <UsersRound size={20} strokeWidth={2.5} className='text-label-large' />

const ResetIcon = <RotateCcw size={20} strokeWidth={2.5} className='text-label-large' />

const CheckIcon = <Check size={18} strokeWidth={3} className='text-heading' />

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

export default function PartyDetailScreen({ partyId }: { partyId: string }) {
  const router = useRouter()
  const [party, setParty] = useState<PartyDetail | null>(null)
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [host, setHost] = useState<PartyHost | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [counts, setCounts] = useState({ going: 0, maybe: 0, not_going: 0 })
  const [copied, setCopied] = useState(false)
  // The status being written, not just a flag: the spinner has to sit on the row
  // that was tapped, and every row is disabled while any one of them is running.
  const [pendingRsvp, setPendingRsvp] = useState<RsvpStatus | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [newLink, setNewLink] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuHeight, setMenuHeight] = useState(MENU_CLOSED_SIZE)
  const menuContentRef = useRef<HTMLDivElement>(null)
  const [pools, setPools] = useState<Pool[]>([])
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [heroLoaded, setHeroLoaded] = useState(false)
  const [openSections, setOpenSections] = useState({ location: true, polls: true, guests: true })

  // One flag per block, so every section clears its own skeleton the moment its data lands.
  const [partyLoading, setPartyLoading] = useState(true)
  const [countsLoading, setCountsLoading] = useState(true)
  const [poolsLoading, setPoolsLoading] = useState(true)
  const [attendeesLoading, setAttendeesLoading] = useState(true)

  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))

  // Dieselbe Sperre, die ConfirmDialog mitbringt — das Erfolgs-Overlay ist kein eigenes
  // Component, also hängt sie hier am State.
  useEffect(() => {
    if (!newLink) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [newLink])

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (!session) { router.push('/login'); return }
      const uid = session.user.id
      setUserId(uid)

      void Promise.all([
        getPartyById(partyId),
        getPartyHost(partyId),
        getMyRsvpStatus(partyId, uid),
      ]).then(([partyData, hostData, status]) => {
        if (cancelled) return
        if (!partyData) {
          alertError('Diese Party konnte nicht geladen werden.')
          router.push('/parties')
          return
        }
        setParty(partyData)
        setHost(hostData)
        setIsHost(partyData.host_id === uid)
        setRsvpStatus(status)
        setPartyLoading(false)
      })

      void getRsvpCountsByStatus(partyId).then((data) => {
        if (cancelled) return
        setCounts(data)
        setCountsLoading(false)
      })

      void getPartyAttendees(partyId).then((data) => {
        if (cancelled) return
        setAttendees(data)
        setAttendeesLoading(false)
      })

      void getPartyPools(partyId).then((data) => {
        if (cancelled) return
        setPools(data)
        setPoolsLoading(false)
      })

      // Needed so my own avatar can be rendered optimistically when I vote in a poll.
      void getMyProfile(uid).then((data) => {
        if (!cancelled) setMyProfile(data)
      })
    })

    return () => { cancelled = true }
  }, [partyId, router])

  // Same three rules as the invite screen, so the ••• menu cannot be used to take a
  // seat the invite page refuses to hand out. There is no RSVP gate here — everyone
  // on this screen is the host or has already answered — so the capacity notice is
  // the only surface the rules touch.
  const full = !countsLoading && isFull(counts.going, party?.max_guests ?? null)
  const showCapacityNotice = isHost || rsvpStatus === 'maybe' || rsvpStatus === 'not_going'
  const seatBlocked = full && rsvpStatus !== 'going'

  // A finished party drops out of both lists, so this screen is only reachable for one
  // by its URL — a bookmark, or the back button. It still has to say so rather than
  // reading as an upcoming party. Same rule as the invite screen.
  const partyOver = !!party && isPartyOver(party.event_date, party.ends_at)

  const refreshPools = () => {
    void getPartyPools(partyId).then(setPools)
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

  // Der Code IST das Geheimnis, nicht die Party-ID — ihn zu ersetzen ist das Einzige,
  // was einem geleakten Link den Zugang wieder nimmt. Erzeugt wird er hier im Client,
  // wie beim Anlegen der Party: events_update_host lässt nur den Host an die Zeile,
  // und das CHECK auf invite_code samt UNIQUE entscheidet, was drinstehen darf.
  const handleResetLink = async () => {
    if (!party) return
    setResetting(true)
    const code = generateInviteCode()
    const { error } = await updateParty(party.id, { invite_code: code })
    if (error) {
      setResetting(false)
      alertError('Der Link konnte nicht zurückgesetzt werden.', error.message)
      return
    }
    // Ohne das gibt der Copy-Button im Header weiter den toten Link aus.
    setParty({ ...party, invite_code: code })
    setResetting(false)
    setConfirmReset(false)
    setNewLink(`${getOrigin()}/e/${code}`)
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
    if (!party || !userId) return
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
    // Hold the menu open briefly so the ✓ visibly lands on the row that was tapped.
    setTimeout(() => setMenuOpen(false), 600)
  }

  const statsLoading = partyLoading || countsLoading

  const stats: { label: string; value: string; warn?: boolean }[] = party
    ? [
        // Ganz vorne, weil die Zeile seitlich scrollt: nur hier steht das Motto ohne
        // Scrollen auf dem Schirm. Ohne Motto entsteht kein Eintrag und die Zeile
        // sieht aus wie zuvor — dasselbe Muster wie bei Max. Gäste weiter unten.
        ...(party.motto ? [{ label: 'Motto', value: party.motto }] : []),
        {
          label: 'Datum',
          value: new Date(party.event_date).toLocaleDateString('de-DE', {
            day: '2-digit', month: '2-digit', year: '2-digit',
          }),
        },
        {
          // The end time is optional, so a party without one keeps the single plain
          // 'Uhrzeit'; as soon as there is an end, the two become a labelled pair.
          label: party.ends_at ? 'Startzeit' : 'Uhrzeit',
          value: new Date(party.event_date).toLocaleTimeString('de-DE', {
            hour: '2-digit', minute: '2-digit',
          }) + ' Uhr',
        },
        ...(party.ends_at
          ? [{
              label: 'Endzeit',
              value: new Date(party.ends_at).toLocaleTimeString('de-DE', {
                hour: '2-digit', minute: '2-digit',
              }) + ' Uhr',
            }]
          : []),
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
    <div className='relative w-full bg-main'>

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
            <button
              onClick={() => router.push('/parties')}
              aria-label='Zurück'
              className={`absolute left-0 top-0 ${iconButtonClass}`}
            >
              {BackIcon}
            </button>

            {/* Role is unknown until the party loads, so hold the spot with a skeleton circle. */}
            {partyLoading && <div className='absolute right-0 top-0 h-11.25 w-11.25 rounded-full skeleton' />}

            {/* The panel expands over this spot, so the copy button steps aside. */}
            {!partyLoading && isHost && (
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

            {!partyLoading && (
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
                    {/* Nobody answers a party that has already happened. */}
                    {!isHost && !partyOver && (
                      <>
                        {RSVP_MENU.map(({ status, label, icon }) => {
                          // Only 'zugesagt' costs a place.
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
                        <div className='h-0.25 w-full bg-divider my-2' />
                      </>
                    )}
                    {/* The host's own controls. Plain rows like every other one —
                        nothing here is special enough to be highlighted. */}
                    {isHost && (
                      <>
                        <button
                          type='button'
                          onClick={() => router.push(`/parties/${partyId}/edit`)}
                          className='flex items-center gap-3 w-full px-4 py-2.5 rounded-full text-left'
                        >
                          <span className='w-5 h-5 flex items-center justify-center'>{EditIcon}</span>
                          <span className='text-label-1 text-label-large'>Bearbeiten</span>
                        </button>

                        <button
                          type='button'
                          onClick={() => router.push(`/parties/${partyId}/guests`)}
                          className='flex items-center gap-3 w-full px-4 py-2.5 rounded-full text-left'
                        >
                          <span className='w-5 h-5 flex items-center justify-center'>{GuestsIcon}</span>
                          <span className='text-label-1 text-label-large'>Gäste verwalten</span>
                        </button>

                        <button
                          type='button'
                          onClick={() => { setMenuOpen(false); setConfirmReset(true) }}
                          className='flex items-center gap-3 w-full px-4 py-2.5 rounded-full text-left'
                        >
                          <span className='w-5 h-5 flex items-center justify-center'>{ResetIcon}</span>
                          <span className='text-label-1 text-label-large'>Link resetten</span>
                        </button>

                        <div className='h-0.25 w-full bg-divider my-2' />
                      </>
                    )}

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
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className='relative px-4 pb-7.5 bg-main flex flex-col gap-12.5'>

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
          {/* Somebody's home address, so it stops being shown once the party is over.
              The host keeps seeing their own. */}
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

          {poolsLoading ? (
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

      {confirmReset && (
        <ConfirmDialog
          title='Link wirklich zurücksetzen?'
          message='Der alte Link funktioniert danach nicht mehr. Wer ihn schon hat, kommt nicht mehr rein.'
          confirmLabel='Zurücksetzen'
          pending={resetting}
          onConfirm={handleResetLink}
          onCancel={() => setConfirmReset(false)}
        />
      )}

      {/* Der neue Link, sofort zum Weitergeben — dieselbe Karte wie am Ende von Create
          Party. Das Häkchen über der Überschrift ist die einzige Bestätigung, dass der
          Reset durch ist; der Copy-Button bringt sein eigenes mit. */}
      {newLink && (
        <div
          role='dialog'
          aria-modal='true'
          aria-labelledby='reset-done-title'
          className='fixed inset-0 z-50 flex items-center justify-center px-7.5'
        >
          <div className='absolute inset-0 bg-main/60 backdrop-blur-sm' />

          <div className='relative w-full max-w-80 flex flex-col gap-5 rounded-[25px] bg-quaternary backdrop-blur-2xl p-5 animate-fade-in-up'>
            <div className='flex flex-col items-center gap-1.5 text-center'>
              <span className='flex h-10 w-10 items-center justify-center rounded-full bg-sheet text-sheet-heading'>
                <Check size={22} strokeWidth={3} />
              </span>
              <span id='reset-done-title' className='text-heading-4 font-semibold text-heading'>
                Link zurückgesetzt
              </span>
              <span className='text-subheading-1 text-subheading'>
                Schick den neuen Link an alle, die weiter dabei sein sollen.
              </span>
            </div>

            <div className='flex flex-col gap-2'>
              <InviteLinkCard link={newLink} />

              <button type='button' onClick={() => setNewLink(null)} className={primaryButtonClass}>
                Fertig
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
