'use client'

import { useState, type FormEvent } from 'react'
import { Send } from 'lucide-react'
import { upsertPoolResponse, type DetailPoll } from '@/features/parties/services/pools.service'
import { alertError } from '@/lib/utils'

// The answer row of a question card (App Redesign 3.5, card 9): `Antwort`, the input
// and a blue send button. Starts with the own answer; sending replaces it in one
// transaction. The answer shows at once; a failed write puts the old one back and keeps
// the typed text for another try. 25 characters, as the CHECK on the table.
export default function AnswerRow({
  question,
  userId,
  disabled,
  onChange,
  onSaved,
}: {
  question: DetailPoll
  userId: string | null
  disabled: boolean
  onChange: (question: DetailPoll) => void
  onSaved: () => void
}) {
  const current = question.responses.find((response) => response.user_id === userId)
  const [text, setText] = useState(current?.text_response ?? '')
  const [writing, setWriting] = useState(false)
  const answer = text.trim()
  const canSend = !disabled && !writing && !!userId && answer !== '' && answer !== current?.text_response

  const send = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSend || !userId) return
    setWriting(true)
    onChange({
      ...question,
      responses: [
        ...question.responses.filter((response) => response.user_id !== userId),
        {
          option_id: null,
          user_id: userId,
          firstname: current?.firstname ?? null,
          lastname: current?.lastname ?? null,
          avatar_url: current?.avatar_url ?? null,
          avatar_color: current?.avatar_color ?? null,
          text_response: answer,
        },
      ],
    })
    const { error } = await upsertPoolResponse(question.pool_id, null, answer)
    setWriting(false)
    if (error) {
      onChange(question)
      alertError('Deine Antwort konnte nicht gespeichert werden.', error.message)
      return
    }
    setText(answer)
    onSaved()
  }

  return (
    <form onSubmit={send} className={`mt-3 flex items-center gap-3 border-t border-divider pt-3 ${disabled ? 'opacity-50' : ''}`}>
      <span className='shrink-0 text-text-3 font-semibold text-heading'>Antwort</span>
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={25}
        disabled={disabled}
        placeholder='z.B. bringe Chips mit'
        aria-label='Antwort'
        className='min-w-0 flex-1 bg-transparent text-right text-text-3 text-heading outline-none placeholder:text-input'
      />
      <button
        type='submit'
        disabled={!canSend}
        aria-label='Antwort abschicken'
        className='flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-main-white transition-opacity disabled:opacity-40'
      >
        <Send size={13} />
      </button>
    </form>
  )
}
