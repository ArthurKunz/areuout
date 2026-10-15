'use client'

import { useState } from 'react'
import AnswerBubble from '@/components/shared/AnswerBubble'
import type { DetailPoll } from '@/features/parties/services/pools.service'
import type { ProfileUser } from './ProfilePage'
import ReportPrompt from './ReportPrompt'

const fullName = (firstname: string | null, lastname: string | null) => [firstname, lastname].filter(Boolean).join(' ')

// Page `Frage` (App Redesign 3.6, mockup My Parties 09), laid out like a chat: the
// question on the left with the host's name, every answer on the right with its
// author's. The viewer's own answer comes first and blue, the others dark.
// Every name but the viewer's own opens its author's profile, and every answer but the
// viewer's own carries the flag to report it, with its text as shown (step 13b).
export default function QuestionPage({
  partyId,
  question,
  host,
  userId,
  onProfile,
}: {
  partyId: string
  question: DetailPoll
  host: ProfileUser
  userId: string | null
  onProfile: (user: ProfileUser) => void
}) {
  type Answer = (typeof question.responses)[number]
  const [reporting, setReporting] = useState<Answer | null>(null)
  // The answer last reported: the prompt keeps it while it fades out.
  const [asked, setAsked] = useState<Answer | null>(null)
  if (reporting && reporting !== asked) setAsked(reporting)
  const answers = question.responses.filter((response) => response.text_response)
  const ordered = [
    ...answers.filter((answer) => answer.user_id === userId),
    ...answers.filter((answer) => answer.user_id !== userId),
  ]

  return (
    <div className='flex flex-col gap-2.5'>
      <AnswerBubble
        name={fullName(host.firstname, host.lastname)}
        text={question.question}
        variant='other'
        onName={host.id === userId ? undefined : () => onProfile(host)}
      />
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
            onName={
              answer.user_id === userId
                ? undefined
                : () =>
                    onProfile({
                      id: answer.user_id,
                      firstname: answer.firstname,
                      lastname: answer.lastname,
                      avatarUrl: answer.avatar_url,
                      avatarColor: answer.avatar_color,
                    })
            }
            onReport={answer.user_id === userId ? undefined : () => setReporting(answer)}
          />
        ))
      )}
      {asked && (
        <ReportPrompt
          open={reporting !== null}
          title='Antwort melden'
          target={{ kind: 'answer', reportedUserId: asked.user_id, eventId: partyId, answerText: asked.text_response ?? '' }}
          onClose={() => setReporting(null)}
        />
      )}
    </div>
  )
}
