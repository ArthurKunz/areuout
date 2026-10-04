'use client'

import type { ReactNode } from 'react'
import {
  CalendarDays,
  ChartBar,
  ChevronRight,
  Clock,
  Footprints,
  Info,
  Lightbulb,
  MessageCircleQuestion,
  Shirt,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Database } from '@/types/database.types'

export type PartyDetailRow = Database['public']['Functions']['get_party_detail']['Returns'][number]
export type PartyPollRow = Database['public']['Functions']['get_party_polls']['Returns'][number]
type PollOption = { option_id: string; label: string }

const pad = (n: number) => String(n).padStart(2, '0')
const formatTime = (iso: string) => {
  const date = new Date(iso)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}
// DD.MM.YY in the viewer's time zone, as in the Hosting list.
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })

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
} as const

const linkRow = 'flex h-11 w-full items-center justify-between text-text-2 text-blue'

// One dark rounded card: a round coloured icon, the bold title, the grey value under
// it, and below a hairline an optional link row (App Redesign 3.5).
function InfoCard({
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
      <span className='text-text-2 font-bold break-words text-heading'>{title}</span>
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

// A link that only looks like one: its page comes in step 7.
const LaterLink = ({ label }: { label: string }) => (
  <span className={linkRow}>
    {label}
    <ChevronRight size={20} />
  </span>
)

// The cards of the detail in the vault's order, each only when its content exists. Half
// cards (Datum, Uhrzeit, Dresscode, Motto) share a row; a lone one keeps half width.
// Polls and questions are display only in this step; voting and answering come in step 7.
export default function DetailCards({ party, polls }: { party: PartyDetailRow; polls: PartyPollRow[] }) {
  const time = party.ends_at
    ? `${formatTime(party.event_date)} - ${formatTime(party.ends_at)} Uhr`
    : `${formatTime(party.event_date)} Uhr`

  return (
    <div className='grid grid-cols-2 gap-2.5'>
      <InfoCard icon={CalendarDays} color='red' title='Datum' value={formatDate(party.event_date)} />
      <InfoCard icon={Clock} color='green' title='Uhrzeit' value={time} />
      {party.location && (
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
      )}
      {party.dresscode && <InfoCard icon={Shirt} color='pink' title='Dresscode' value={party.dresscode} />}
      {party.motto && <InfoCard icon={Lightbulb} color='orange' title='Motto' value={party.motto} />}
      <InfoCard
        icon={Users}
        color='blue'
        title='Teilnehmer'
        value={party.max_guests ? `max. ${party.max_guests}` : undefined}
        wide
        link={<LaterLink label='Gästeliste anzeigen' />}
      />
      {party.description && <InfoCard icon={Info} color='taupe' title='Infos' value={party.description} wide />}
      {polls.map((poll) =>
        poll.type === 'options' ? (
          <InfoCard
            key={poll.pool_id}
            icon={ChartBar}
            color='purple'
            title={poll.question}
            wide
            link={<LaterLink label='Votes anzeigen' />}
          >
            <ul className='mt-1 flex flex-col gap-1'>
              {(poll.options as unknown as PollOption[]).map((option) => (
                <li key={option.option_id} className='text-text-3 break-words text-text'>
                  {option.label}
                </li>
              ))}
            </ul>
          </InfoCard>
        ) : (
          <InfoCard
            key={poll.pool_id}
            icon={MessageCircleQuestion}
            color='yellow'
            title={poll.question}
            wide
            link={<LaterLink label='Antworten anzeigen' />}
          />
        )
      )}
    </div>
  )
}
