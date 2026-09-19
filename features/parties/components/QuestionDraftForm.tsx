'use client'

import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { cardClass, primaryButtonClass, rowClass, rowInputClass, rowLabelClass } from '@/components/shared/Card'
import Collapse from '@/components/shared/Collapse'
import WarningBanner from '@/components/shared/WarningBanner'
import UnsavedChangesDialog from '@/components/shared/UnsavedChangesDialog'
import type { QuestionDraft } from '../types/parties.types'

const QUESTION_MAX = 60
const DESCRIPTION_MAX = 300

// Eine Frage im Entwurf, wie PoolDraftForm — nur ohne Optionen und ohne den Schalter
// fuer mehrere Antworten, weil es bei einer offenen Frage nichts auszuwaehlen gibt.
// Auch hier wird nichts geschrieben: der fertige Entwurf geht zurueck an den
// Aufrufer, und der schreibt ihn, wenn die Party angelegt bzw. gespeichert wird.
export default function QuestionDraftForm({
  draft,
  onAdd,
  onCancel,
  commit = 'button',
}: {
  draft?: QuestionDraft
  onAdd: (draft: QuestionDraft) => void
  onCancel: () => void
  // Dieselben zwei Bedeutungen wie bei den Umfragen: 'button' im Erstellen-Flow mit
  // einem ausdruecklichen Hinzufuegen, 'onBack' im Bearbeiten-Screen, wo erst dessen
  // eigenes Speichern etwas schreibt und ein zweiter Knopf hier mehr verspraeche.
  commit?: 'button' | 'onBack'
}) {
  const [question, setQuestion] = useState(draft?.question ?? '')
  const [description, setDescription] = useState(draft?.description ?? '')
  const [askLeave, setAskLeave] = useState(false)

  const canAdd = question.trim().length > 0

  const untouched =
    JSON.stringify({ q: draft?.question ?? '', d: draft?.description ?? '' }) ===
    JSON.stringify({ q: question, d: description })

  // Wortgleich mit PoolDraftForm: eine Frage fragt etwas, das Fragezeichen ist nicht
  // die Aufgabe des Gastgebers. Erst beim Speichern angewendet, nicht beim Tippen.
  const withQuestionMark = (value: string) => {
    const trimmed = value.trim()
    if (trimmed.endsWith('?') || trimmed.endsWith('!')) return trimmed
    return trimmed.endsWith('.') ? `${trimmed.slice(0, -1)}?` : `${trimmed}?`
  }

  const buildDraft = (): QuestionDraft => ({
    id: draft?.id ?? crypto.randomUUID(),
    question: withQuestionMark(question),
    description: description.trim() || null,
  })

  const handleBack = () => {
    if (commit === 'onBack') {
      if (canAdd) onAdd(buildDraft())
      else onCancel()
      return
    }
    if (untouched || !canAdd) {
      onCancel()
      return
    }
    setAskLeave(true)
  }

  return (
    <div className='relative w-full min-h-dvh'>
      <div className='fixed inset-x-0 top-0 z-20 px-4 pt-7.5'>
        <button
          type='button'
          onClick={handleBack}
          aria-label='Zurück'
          className='flex h-11.25 w-11.25 items-center justify-center rounded-full bg-secondary backdrop-blur-xl transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95'
        >
          <ChevronLeft size={24} strokeWidth={3} className='text-white' />
        </button>
      </div>

      <div className='relative z-10 flex min-h-dvh flex-col px-4 pt-26.25 pb-safe-rsvp'>
        {/* Waechst per Hoehe auf, nicht per Opazitaet oder Transform: alles darin ist
            eine backdrop-blur-xl-Karte, und ein Vorfahr, der beides animiert, wuerde
            deren Hintergrundwurzel werden und die Seite bis zum Ende grau lassen. */}
        <Collapse open appear className='mt-auto'>
          <div className='flex w-full flex-col gap-3'>
            <div className={cardClass}>
              <div className={rowClass}>
                <span className={rowLabelClass}>Frage</span>
                <input
                  type='text'
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder='z.B. Wer bringt eine Box mit?'
                  maxLength={QUESTION_MAX}
                  className={rowInputClass}
                />
              </div>
            </div>

            {question.length >= QUESTION_MAX && (
              <WarningBanner message={`Maximal ${QUESTION_MAX} Zeichen pro Frage`} />
            )}

            <div className={`${cardClass} p-4`}>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder='Details'
                rows={3}
                maxLength={DESCRIPTION_MAX}
                className='w-full resize-none bg-transparent text-button text-subheading outline-none'
              />
            </div>

            {description.length >= DESCRIPTION_MAX && (
              <WarningBanner message={`Maximal ${DESCRIPTION_MAX} Zeichen`} />
            )}

            {commit === 'button' && (
              <button
                type='button'
                disabled={!canAdd}
                onClick={() => onAdd(buildDraft())}
                className={primaryButtonClass}
              >
                {draft ? 'Speichern' : 'Hinzufügen'}
              </button>
            )}
          </div>
        </Collapse>
      </div>

      {askLeave && (
        <UnsavedChangesDialog
          onSave={() => onAdd(buildDraft())}
          onDiscard={onCancel}
          onCancel={() => setAskLeave(false)}
        />
      )}
    </div>
  )
}
