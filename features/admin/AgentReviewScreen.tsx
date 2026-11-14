'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert, Copy, Flag } from 'lucide-react'
import { FitSheet } from '@/components/shell/Shell'
import StepFrame from '@/features/create-party/StepFrame'
import LoadError from '@/components/shared/LoadError'
import { Alert, AlertDescription, AlertTitle } from '@/components/shared/Alert'
import ConfirmPrompt from '@/features/party-detail/ConfirmPrompt'
import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Draft = Database['public']['Functions']['get_agent_drafts']['Returns'][number]
type Report = Database['public']['Functions']['get_agent_reports']['Returns'][number]

const pad = (n: number) => String(n).padStart(2, '0')
// Formats as in the detail's cards (DetailCards), plus the weekday: 'Mi., 18.11.26', HH:MM, '5€'.
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })
const formatTime = (iso: string) => {
  const date = new Date(iso)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}
const formatPrice = (value: number) =>
  Number.isInteger(value) ? `${value}€` : `${value.toFixed(2).replace('.', ',')}€`

// The agent runs every Monday and Thursday (Party Agent section 8): the next of the two
// after today.
function nextRunDay() {
  const day = new Date().getDay()
  return day >= 1 && day < 4 ? 'Donnerstag' : 'Montag'
}

const textButton = 'shrink-0 text-text-3 font-semibold transition-opacity duration-(--duration-press) ease-ios active:opacity-60'

// Page `Neue Events` (Party Agent step 4), only for admins (app/(shell)/admin/page.tsx).
// Every open draft of the agent, the soonest event first as get_agent_drafts returns it.
// `Freigeben` publishes it, `Verwerfen` drops it; the card leaves at once and comes back
// if the call fails, as in MeBlockedScreen. `Quelle ansehen` sits high up because a
// draft must be checked against its source before it is approved.
// Above the drafts, the agent events an organiser asked to remove (step 5, Party Agent
// section 8 "Organisers"): `Entfernen` deletes the event and blocks its source link,
// after a question since it cannot be undone; `Behalten` closes the reports.
export default function AgentReviewScreen() {
  const router = useRouter()
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [reports, setReports] = useState<Report[] | null>(null)
  // The report whose `Entfernen` is being asked about, and the one last asked about: the
  // prompt keeps its title while it fades out (GuestsPage).
  const [removing, setRemoving] = useState<Report | null>(null)
  const [asked, setAsked] = useState<Report | null>(null)
  if (removing && removing !== asked) setAsked(removing)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [actionFailed, setActionFailed] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([supabase.rpc('get_agent_drafts'), supabase.rpc('get_agent_reports')]).then(([draftList, reportList]) => {
      const error = draftList.error ?? reportList.error
      if (error) {
        console.error('[areuout]', error.message)
        setFailed(true)
        return
      }
      setDrafts(draftList.data)
      setReports(reportList.data)
    })
  }, [attempt])

  const decide = async (draft: Draft, approve: boolean) => {
    setActionFailed(null)
    const index = drafts?.indexOf(draft) ?? 0
    setDrafts((current) => current?.filter((item) => item.id !== draft.id) ?? null)
    const { error } = approve
      ? await supabase.rpc('approve_agent_candidate', { p_id: draft.id })
      : await supabase.rpc('discard_agent_candidate', { p_id: draft.id })
    if (error) {
      console.error('[areuout]', error.message)
      setDrafts((current) => current && [...current.slice(0, index), draft, ...current.slice(index)])
      setActionFailed(`${draft.title}: ${error.message}`)
    }
  }

  const keep = async (report: Report) => {
    setActionFailed(null)
    const index = reports?.indexOf(report) ?? 0
    setReports((current) => current?.filter((item) => item.event_id !== report.event_id) ?? null)
    const { error } = await supabase.rpc('keep_agent_event', { p_event_id: report.event_id })
    if (error) {
      console.error('[areuout]', error.message)
      setReports((current) => current && [...current.slice(0, index), report, ...current.slice(index)])
      setActionFailed(`${report.title}: ${error.message}`)
    }
  }

  const remove = async () => {
    if (!removing) return
    setActionFailed(null)
    setPending(true)
    const { error } = await supabase.rpc('remove_agent_event', { p_event_id: removing.event_id })
    setPending(false)
    if (error) {
      console.error('[areuout]', error.message)
      setActionFailed(`${removing.title}: ${error.message}`)
    } else {
      setReports((current) => current?.filter((item) => item.event_id !== removing.event_id) ?? null)
    }
    setRemoving(null)
  }

  return (
    <>
      <FitSheet />
      <StepFrame title='Neue Events' onBack={() => router.push('/me')} button={null}>
        {failed ? (
          <div className='w-full max-w-[350px]'>
            <LoadError
              text='Die Entwürfe konnten nicht geladen werden.'
              onRetry={() => {
                setFailed(false)
                setAttempt((n) => n + 1)
              }}
            />
          </div>
        ) : !drafts || !reports ? (
          <div className='h-27.5 w-full max-w-[350px] rounded-[25px] skeleton' />
        ) : (
          <>
            {actionFailed && (
              <div className='w-full max-w-[350px]'>
                <Alert>
                  <CircleAlert />
                  <AlertTitle>Das ging nicht</AlertTitle>
                  <AlertDescription>{actionFailed}</AlertDescription>
                </Alert>
              </div>
            )}
            {reports.map((report) => (
              <article key={report.event_id} className='flex w-full max-w-[350px] flex-col gap-3 rounded-[25px] bg-main p-4'>
                <div className='flex flex-col gap-1'>
                  <h2 className='text-text-2 font-bold text-heading'>{report.title}</h2>
                  <span className='text-text-3 text-text'>
                    {formatDate(report.event_date)} · {formatTime(report.event_date)}
                  </span>
                  <a
                    href={report.source_url}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='truncate text-text-3 font-semibold text-brand transition-opacity duration-(--duration-press) ease-ios active:opacity-60'
                  >
                    Quelle ansehen
                  </a>
                </div>
                <Alert tone='notice'>
                  <Flag />
                  <AlertDescription>
                    {report.report_count === 1 ? 'Veranstalter-Meldung' : `${report.report_count} Meldungen`}
                  </AlertDescription>
                </Alert>
                <div className='h-px w-full bg-divider' />
                <div className='flex items-center justify-between'>
                  <button type='button' onClick={() => keep(report)} className={`${textButton} text-text`}>
                    Behalten
                  </button>
                  <button type='button' onClick={() => setRemoving(report)} className={`${textButton} text-red`}>
                    Entfernen
                  </button>
                </div>
              </article>
            ))}
            {drafts.length === 0 && reports.length === 0 ? (
              <div className='flex flex-col items-center gap-1 pt-2 text-center'>
                <span className='text-text-2 font-bold text-heading'>Alles erledigt</span>
                <span className='text-text-3 text-text'>Am {nextRunDay()} sucht der Agent wieder</span>
              </div>
            ) : (
              drafts.map((draft) => (
                <article key={draft.id} className='flex w-full max-w-[350px] flex-col gap-3 rounded-[25px] bg-main p-4'>
                  <img src={draft.background_url} alt='' className='aspect-[16/9] w-full rounded-[15px] object-cover' />
                  <div className='flex flex-col gap-1'>
                    <h2 className='text-text-2 font-bold text-heading'>{draft.title}</h2>
                    <span className='text-text-3 text-text'>
                      {formatDate(draft.starts_at)} · {formatTime(draft.starts_at)}
                      {draft.ends_at && `–${formatTime(draft.ends_at)}`}
                      {draft.price !== null && ` · ${formatPrice(draft.price)}`}
                    </span>
                    <span className='text-text-3 text-text'>{draft.location}</span>
                    {draft.organizer_name && <span className='text-text-3 text-text'>Veranstalter: {draft.organizer_name}</span>}
                    <a
                      href={draft.source_url}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='truncate text-text-3 font-semibold text-brand transition-opacity duration-(--duration-press) ease-ios active:opacity-60'
                    >
                      Quelle ansehen
                    </a>
                  </div>
                  {draft.duplicate_title && (
                    <Alert tone='notice'>
                      <Copy />
                      <AlertDescription>Vielleicht schon vorhanden: {draft.duplicate_title}</AlertDescription>
                    </Alert>
                  )}
                  <p className='text-text-3 text-text'>{draft.description}</p>
                  <div className='h-px w-full bg-divider' />
                  <div className='flex items-center justify-between'>
                    <button type='button' onClick={() => decide(draft, false)} className={`${textButton} text-text`}>
                      Verwerfen
                    </button>
                    <button type='button' onClick={() => decide(draft, true)} className={`${textButton} text-brand`}>
                      Freigeben
                    </button>
                  </div>
                </article>
              ))
            )}
          </>
        )}
      </StepFrame>
      {asked && (
        <ConfirmPrompt
          open={removing !== null}
          title={`${asked.title} entfernen?`}
          message='Das Event verschwindet für alle, und der Agent nimmt diese Quelle nicht wieder auf.'
          confirmLabel='Entfernen'
          pending={pending}
          onConfirm={remove}
          onCancel={() => setRemoving(null)}
        />
      )}
    </>
  )
}
