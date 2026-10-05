'use client'

import AnswerBubble from '@/components/shared/AnswerBubble'
import type { DetailPoll } from '@/features/parties/services/pools.service'

const fullName = (firstname: string | null, lastname: string | null) => [firstname, lastname].filter(Boolean).join(' ')

// Page `Frage` (App Redesign 3.6, mockup My Parties 09), laid out like a chat: the
// question on the left with the host's name, every answer on the right with its
// author's. The viewer's own answer comes first and blue, the others dark.
export default function QuestionPage({ question, hostName, userId }: { question: DetailPoll; hostName: string; userId: string | null }) {
  const answers = question.responses.filter((response) => response.text_response)
  const ordered = [
    ...answers.filter((answer) => answer.user_id === userId),
    ...answers.filter((answer) => answer.user_id !== userId),
  ]

  return (
    <div className='flex flex-col gap-2.5'>
      <AnswerBubble name={hostName} text={question.question} variant='other' />
      {ordered.length === 0 ? (
        <span className='pt-4 text-center text-text-3 text-text'>Noch keine Antworten</span>
      ) : (
        ordered.map((answer) => (
          <AnswerBubble
            key={answer.user_id}
            name={fullName(answer.firstname, answer.lastname)}
            text={answer.text_response ?? ''}
            variant={answer.user_id === userId ? 'own' : 'other'}
            align='right'
          />
        ))
      )}
    </div>
  )
}
