'use client'

import Avatar from './Avatar'

// One block per option on the poll results page: the option label and its
// vote count, a divider, then one 50px row per voter (avatar + name). Same
// bg-main + 100px blur as the other info cards.
export default function PollOptionResults({
  label,
  votes,
  voters,
}: {
  label: string
  votes: number
  voters: { id: string; firstname: string | null; lastname: string | null; avatarUrl: string | null; avatarColor: string | null }[]
}) {
  return (
    <div className='flex w-full flex-col rounded-[25px] bg-main p-4 glass-control'>
      <div className='flex items-center justify-between gap-3'>
        <span className='min-w-0 break-words text-text-2 font-semibold text-heading'>{label}</span>
        <span className='shrink-0 text-text-2 text-text'>{votes} Votes</span>
      </div>
      {voters.length > 0 && <div className='mt-3 h-px w-full bg-divider' />}
      {voters.map((voter, i) => (
        <div key={voter.id} className='flex flex-col'>
          <div className='flex h-[50px] items-center gap-3'>
            <Avatar size={30} url={voter.avatarUrl} color={voter.avatarColor} firstname={voter.firstname} lastname={voter.lastname} />
            <span className='min-w-0 flex-1 truncate text-text-3 font-bold text-heading'>
              {[voter.firstname, voter.lastname].filter(Boolean).join(' ')}
            </span>
          </div>
          {i < voters.length - 1 && <div className='h-px w-full bg-divider' />}
        </div>
      ))}
    </div>
  )
}
