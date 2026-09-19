'use client'

import { useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { alertError } from '@/lib/utils'
import type { Profile } from '@/features/profile/services/profile.service'
import { upsertPoolResponse } from '../services/pools.service'
import WarningBanner from '@/components/shared/WarningBanner'
import Avatar from '@/components/shared/Avatar'
import type { Question } from '../types/parties.types'

// Eine Antwort ist eine Zeile in derselben Liste wie die anderen und darf deshalb
// nicht umbrechen: `text-label-1` (13px) neben Avatar und Namen laesst etwa 25
// Zeichen. Dieselbe Rechnung wie beim Options-Limit der Umfragen.
const ANSWER_MAX = 25

type Props = {
  question: Question
  userId: string
  myProfile: Profile | null
  onRefresh: () => void
}

export default function QuestionCard({ question, userId, myProfile, onRefresh }: Props) {
  const myAnswer = question.answers.find((a) => a.user_id === userId) ?? null
  const others = question.answers.filter((a) => a.user_id !== userId)

  // Die eigene Antwort steht NICHT in der Liste, sondern ist das Eingabefeld selbst —
  // sonst staende sie zweimal da, einmal zum Lesen und einmal zum Aendern.
  //
  // `sent` haelt sie fest, bis der Refetch sie zurueckbringt, `draft` das gerade
  // Getippte. Ein gescheiterter Schreibvorgang laesst `draft` stehen: was jemand
  // getippt hat, wird ihm nicht unter den Fingern weggenommen.
  const [draft, setDraft] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const saved = sent ?? myAnswer?.text_response ?? ''
  const value = draft ?? saved
  const trimmed = value.trim()
  const canSend = trimmed.length > 0 && trimmed !== saved && !submitting

  const handleSend = async () => {
    if (!canSend) return
    const previous = sent
    setSent(trimmed)
    setSubmitting(true)
    // option_id bleibt null — eine Frage hat nichts zum Auswaehlen. Die RPC dahinter
    // ersetzt die alte Antwort in einer einzigen Transaktion.
    const { error } = await upsertPoolResponse(question.id, null, trimmed)
    setSubmitting(false)
    if (error) {
      setSent(previous)
      alertError('Deine Antwort konnte nicht gespeichert werden.', error.message)
      return
    }
    setDraft(null)
    onRefresh()
  }

  return (
    <div className='flex flex-col gap-4'>
      <div>
        <span className='block text-subheading-1 font-semibold text-heading'>{question.question}</span>
        {question.description && (
          <span className='block mt-1 text-body-1 text-body'>{question.description}</span>
        )}
      </div>

      <div className='flex flex-col gap-2'>
        {others.map((answer) => (
          <div
            key={answer.id}
            className='flex h-12.5 items-center gap-3 rounded-full bg-secondary pl-3 pr-4'
          >
            <Avatar
              size={24}
              url={answer.avatar_url}
              color={answer.avatar_color}
              firstname={answer.firstname}
              lastname={answer.lastname}
            />
            <span className='truncate text-label-1 text-heading'>{answer.text_response}</span>
            <span className='ml-auto shrink-0 text-label-2 text-label-small'>{answer.firstname}</span>
          </div>
        ))}

        {/* Die eigene Zeile, in Tertiaer wie die gewaehlte Option einer Umfrage. */}
        <div className='flex h-12.5 items-center gap-3 rounded-full bg-tertiary backdrop-blur-xl pl-3 pr-3'>
          <Avatar
            size={24}
            url={myProfile?.avatar_url ?? myAnswer?.avatar_url ?? null}
            color={myProfile?.avatar_color ?? myAnswer?.avatar_color ?? null}
            firstname={myProfile?.firstname ?? myAnswer?.firstname ?? null}
            lastname={myProfile?.lastname ?? myAnswer?.lastname ?? null}
          />
          <input
            type='text'
            value={value}
            onChange={(e) => setDraft(e.target.value)}
            placeholder='Deine Antwort'
            maxLength={ANSWER_MAX}
            enterKeyHint='send'
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleSend()
              }
            }}
            className='min-w-0 flex-1 bg-transparent text-label-1 text-heading outline-none placeholder:text-label-small'
          />
          {/* Erscheint erst, wenn es etwas zu senden gibt — eine unveraenderte Antwort
              hat keinen Knopf, den man vergeblich druecken kann. */}
          {canSend && (
            <button
              type='button'
              onClick={() => void handleSend()}
              aria-label='Antwort senden'
              className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95'
            >
              <ArrowUp size={18} strokeWidth={3} className='text-white' />
            </button>
          )}
        </div>
      </div>

      {value.length >= ANSWER_MAX && <WarningBanner message={`Maximal ${ANSWER_MAX} Zeichen`} />}
    </div>
  )
}
