'use client'

import { useState } from 'react'
import { Check, CircleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/shared/Alert'
import { REPORT_REASONS, submitReport, type ReportReason, type ReportTarget } from '@/features/parties/services/reports.service'
import { INTERNAL_DETAIL } from '@/lib/utils'
import ConfirmPrompt from './ConfirmPrompt'

// The reason dialog for a party, an answer or a person (step 13b): four reasons, one
// tap each, then `Melden`. Same prompt as every other question in the detail; after
// sending it turns into the thanks in place. A repeat is a silent success on the server,
// so it thanks the same way. A refusal (20 in 24 hours, a target that is gone) is a
// German sentence from submit_report and shows in the red Alert.
export default function ReportPrompt({
  open,
  title,
  target,
  onClose,
}: {
  open: boolean
  title: string
  target: ReportTarget
  onClose: () => void
}) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  // Every opening starts fresh; closing keeps the words while the prompt fades.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setReason(null)
      setError(null)
      setDone(false)
    }
  }

  const send = async () => {
    if (!reason) return
    setPending(true)
    setError(null)
    const { error } = await submitReport(target, reason)
    setPending(false)
    if (error) {
      if (INTERNAL_DETAIL.test(error.message)) console.error('[areuout]', error.message)
      setError(INTERNAL_DETAIL.test(error.message) ? 'Deine Meldung konnte nicht gesendet werden.' : error.message)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <ConfirmPrompt
        open={open}
        title='Danke für deine Meldung'
        message='Wir sehen sie uns innerhalb von 24 Stunden an. Die gemeldete Person erfährt nicht, dass die Meldung von dir kommt.'
        cancelLabel='Fertig'
        pending={false}
        onCancel={onClose}
      />
    )
  }

  return (
    <ConfirmPrompt
      open={open}
      title={title}
      message='Wähle einen Grund. Wir sehen uns jede Meldung innerhalb von 24 Stunden an.'
      confirmLabel='Melden'
      confirmDisabled={reason === null}
      pending={pending}
      onConfirm={send}
      onCancel={onClose}
    >
      {/* RsvpStatusMenu's rows: the tick keeps its column, so a new choice moves only
          the tick. */}
      <div role='radiogroup' aria-label='Grund' className='flex w-full flex-col'>
        {REPORT_REASONS.map((option, i) => (
          <div key={option.value}>
            {i > 0 && <div className='mx-3 h-px rounded-full bg-divider' />}
            <button
              type='button'
              role='radio'
              aria-checked={reason === option.value}
              onClick={() => setReason(option.value)}
              disabled={pending}
              className='flex h-11 w-full items-center gap-2 px-3 text-left text-text-2 font-medium text-heading'
            >
              <span className='flex size-5 shrink-0 items-center'>
                {reason === option.value && <Check size={20} className='icon-in' />}
              </span>
              <span>{option.label}</span>
            </button>
          </div>
        ))}
      </div>
      {error && (
        <Alert>
          <CircleAlert />
          <AlertTitle>Das ging nicht</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </ConfirmPrompt>
  )
}
