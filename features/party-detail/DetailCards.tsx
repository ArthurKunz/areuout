'use client'

import { Fragment, type ReactNode } from 'react'
import {
  CalendarDays,
  ChartBar,
  ChevronRight,
  Clock,
  Euro,
  Footprints,
  Info,
  Lightbulb,
  MessageCircleQuestion,
  Shirt,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { DetailPoll } from '@/features/parties/services/pools.service'
import type { Database } from '@/types/database.types'
import AnswerRow from './AnswerRow'
import PollOptions from './PollOptions'
import type { ProfileUser } from './ProfilePage'

export type PartyDetailRow = Database['public']['Functions']['get_party_detail']['Returns'][number]

// The pages inside the detail (App Redesign 3.6), opened from the card links.
export type DetailPage =
  | { kind: 'guests' }
  | { kind: 'requests' }
  | { kind: 'poll'; id: string }
  | { kind: 'question'; id: string }
  | { kind: 'profile'; user: ProfileUser }

const pad = (n: number) => String(n).padStart(2, '0')
const formatTime = (iso: string) => {
  const date = new Date(iso)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}
// DD.MM.YY in the viewer's time zone, as in the Hosting list.
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
// 5 becomes '5€', 2.5 becomes '2,50€': whole euros drop the decimals, the rest keep two,
// with the German comma. The column is numeric(6,2), so there is never a third place.
const formatPrice = (value: number) =>
  Number.isInteger(value) ? `${value}€` : `${value.toFixed(2).replace('.', ',')}€`

// The phone's own map app with the address as destination: Apple Maps on iPhone and
// iPad (iPadOS reports itself as a Mac with touch), Google Maps everywhere else.
function routeUrl(address: string) {
  const destination = encodeURIComponent(address)
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  return ios
    ? `https://maps.apple.com/?daddr=${destination}`
    : `https://www.google.com/maps/dir/?api=1&destination=${destination}`
}

const ICON_CLASS = {
  red: 'bg-red',
  green: 'bg-green',
  sky: 'bg-sky',
  pink: 'bg-pink',
  orange: 'bg-orange',
  blue: 'bg-blue',
  taupe: 'bg-taupe',
  purple: 'bg-purple',
  yellow: 'bg-yellow',
  lime: 'bg-lime',
  slate: 'bg-slate',
} as const

const linkRow = 'flex h-11 w-full items-center justify-between text-text-2 text-blue transition-opacity duration-(--duration-press) ease-ios active:opacity-60'

// One dark rounded card: a round coloured icon, the bold title, the grey value under
// it, and below a hairline an optional link row (App Redesign 3.5).
export function InfoCard({
  icon: Icon,
  color,
  title,
  value,
  link,
  wide = false,
  children,
}: {
  icon: LucideIcon
  color: keyof typeof ICON_CLASS
  title: string
  value?: ReactNode
  link?: ReactNode
  wide?: boolean
  children?: ReactNode
}) {
  return (
    <div className={`flex min-w-0 flex-col rounded-[25px] bg-main px-4 pt-4 ${link ? 'pb-0' : 'pb-4'} ${wide ? 'col-span-2' : ''}`}>
      <span className={`mb-3 flex size-8 items-center justify-center rounded-full text-main-white ${ICON_CLASS[color]}`}>
        <Icon size={18} />
      </span>
      <span className='text-text-2 font-semibold break-words text-heading'>{title}</span>
      {value && <span className='text-text-3 break-words whitespace-pre-line text-text'>{value}</span>}
      {children}
      {link && (
        <>
          <div className='mt-3 h-px rounded-full bg-divider' />
          {link}
        </>
      )}
    </div>
  )
}

type CardSpec = { key: string; half: boolean; render: (wide: boolean) => ReactNode }

// Consecutive half cards fill a row in pairs; one left without a partner takes the full
// width rather than leaving a gap beside it. A full card always starts a new row, so a
// run of half cards is the same thing as a row — the odd last one of a run goes wide.
// The rule lives here and never on a card, so no card decides its own width (DESIGN.md).
function widths(cards: CardSpec[]): boolean[] {
  let col = 0
  return cards.map((card, i) => {
    if (!card.half) {
      col = 0
      return true
    }
    const alone = col === 0 && (i === cards.length - 1 || !cards[i + 1].half)
    col = alone ? 0 : (col + 1) % 2
    return alone
  })
}

const PageLink = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button type='button' onClick={onClick} className={linkRow}>
    {label}
    <ChevronRight size={20} />
  </button>
)

// The cards of the detail in the vault's order, each only when its content exists. They
// are collected as specs rather than written straight into the grid, because a half
// card's width depends on what follows it — see widths() above.
// Polls and questions come only for viewers get_party_poll_data hands them to; without
// an RSVP they show greyed out and only their links work. The host's card `Anfragen`
// sits right after `Teilnehmer` while requests are open (App Redesign 6.3).
export default function DetailCards({
  party,
  polls,
  questions,
  userId,
  canAnswer,
  requestCount,
  onPollChange,
  onPollSaved,
  onOpen,
}: {
  party: PartyDetailRow
  polls: DetailPoll[]
  questions: DetailPoll[]
  userId: string | null
  canAnswer: boolean
  requestCount: number
  onPollChange: (poll: DetailPoll) => void
  onPollSaved: () => void
  onOpen: (page: DetailPage) => void
}) {
  const time = party.ends_at
    ? `${formatTime(party.event_date)} - ${formatTime(party.ends_at)} Uhr`
    : `${formatTime(party.event_date)} Uhr`

  // The end can sit on another day, so the card says both dates rather than the start
  // alone. Same day, or no end at all: the single date as before.
  const date =
    party.ends_at && formatDate(party.ends_at) !== formatDate(party.event_date)
      ? `${formatDate(party.event_date)} - ${formatDate(party.ends_at)}`
      : formatDate(party.event_date)

  const cards: CardSpec[] = []
  const half = (key: string, render: (wide: boolean) => ReactNode) => cards.push({ key, half: true, render })
  const full = (key: string, node: ReactNode) => cards.push({ key, half: false, render: () => node })

  half('datum', (wide) => <InfoCard icon={CalendarDays} color='red' title='Datum' value={date} wide={wide} />)
  half('uhrzeit', (wide) => <InfoCard icon={Clock} color='green' title='Uhrzeit' value={time} wide={wide} />)
  if (party.location) {
    full(
      'location',
      <InfoCard
        icon={Footprints}
        color='sky'
        title='Location'
        value={party.location}
        wide
        link={
          <a href={routeUrl(party.location)} target='_blank' rel='noopener noreferrer' className={linkRow}>
            Route anzeigen
            <ChevronRight size={20} />
          </a>
        }
      />
    )
  }
  if (party.dresscode) {
    half('dresscode', (wide) => <InfoCard icon={Shirt} color='pink' title='Dresscode' value={party.dresscode} wide={wide} />)
  }
  if (party.motto) {
    half('motto', (wide) => <InfoCard icon={Lightbulb} color='orange' title='Motto' value={party.motto} wide={wide} />)
  }
  if (party.price) {
    half('preis', (wide) => <InfoCard icon={Euro} color='slate' title='Preis' value={formatPrice(party.price)} wide={wide} />)
  }
  full(
    'teilnehmer',
    <InfoCard
      icon={Users}
      color='blue'
      title='Teilnehmer'
      value={party.max_guests ? `max. ${party.max_guests}` : undefined}
      wide
      link={<PageLink label='Gästeliste anzeigen' onClick={() => onOpen({ kind: 'guests' })} />}
    />
  )
  if (requestCount > 0) {
    full(
      'anfragen',
      <InfoCard
        icon={UserPlus}
        color='lime'
        title='Anfragen'
        value={requestCount === 1 ? '1 Anfrage' : `${requestCount} Anfragen`}
        wide
        link={<PageLink label='Anfragen anzeigen' onClick={() => onOpen({ kind: 'requests' })} />}
      />
    )
  }
  if (party.description) {
    full('infos', <InfoCard icon={Info} color='taupe' title='Infos' value={party.description} wide />)
  }
  polls.forEach((poll) =>
    full(
      `poll-${poll.pool_id}`,
      <InfoCard
        icon={ChartBar}
        color='purple'
        title={poll.question}
        wide
        link={<PageLink label='Votes anzeigen' onClick={() => onOpen({ kind: 'poll', id: poll.pool_id })} />}
      >
        <PollOptions poll={poll} userId={userId} disabled={!canAnswer} onChange={onPollChange} onSaved={onPollSaved} />
      </InfoCard>
    )
  )
  questions.forEach((question) =>
    full(
      `question-${question.pool_id}`,
      <InfoCard
        icon={MessageCircleQuestion}
        color='yellow'
        title={question.question}
        wide
        link={<PageLink label='Antworten anzeigen' onClick={() => onOpen({ kind: 'question', id: question.pool_id })} />}
      >
        <AnswerRow question={question} userId={userId} disabled={!canAnswer} onChange={onPollChange} onSaved={onPollSaved} />
      </InfoCard>
    )
  )

  return (
    <div className='grid grid-cols-2 gap-2.5'>
      {widths(cards).map((wide, i) => (
        <Fragment key={cards[i].key}>{cards[i].render(wide)}</Fragment>
      ))}
    </div>
  )
}
