'use client'

import PollOptionResults from '@/components/shared/PollOptionResults'
import PollQuestionBanner from '@/components/shared/PollQuestionBanner'
import type { DetailPoll } from '@/features/parties/services/pools.service'

// Page `Umfrage` (App Redesign 3.6, mockup My Parties 10): the question in a card, then
// one card per option with its votes and everyone who picked it.
export default function PollPage({ poll }: { poll: DetailPoll }) {
  return (
    <div className='flex flex-col gap-2.5'>
      <PollQuestionBanner question={poll.question} />
      {poll.options.map((option) => {
        const voters = poll.responses.filter((response) => response.option_id === option.option_id)
        return (
          <PollOptionResults
            key={option.option_id}
            label={option.label}
            votes={voters.length}
            voters={voters.map((voter) => ({
              id: voter.user_id,
              firstname: voter.firstname,
              lastname: voter.lastname,
              avatarUrl: voter.avatar_url,
              avatarColor: voter.avatar_color,
            }))}
          />
        )
      })}
    </div>
  )
}
