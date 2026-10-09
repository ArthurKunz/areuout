'use client'

import Avatar from './Avatar'

// One block per option on the poll results page: the option label and its
// vote count, a divider, then one 50px row per voter (avatar + name). Same
// bg-main + 100px blur as the other info cards. With onOpen, everyone but the viewer
// opens by picture or name.
type Voter = { id: string; firstname: string | null; lastname: string | null; avatarUrl: string | null; avatarColor: string | null }

export default function PollOptionResults({
  label,
  votes,
  voters,
  userId = null,
  onOpen,
}: {
  label: string
  votes: number
  voters: Voter[]
  userId?: string | null
  onOpen?: (voter: Voter) => void
}) {
  return (
    <div className='flex w-full flex-col rounded-[25px] bg-main p-4 glass-field'>
      <div className='flex items-center justify-between gap-3'>
        <span className='min-w-0 break-words text-text-2 font-semibold text-heading'>{label}</span>
        <span className='shrink-0 text-text-2 text-text'>{votes} Votes</span>
      </div>
      {voters.length > 0 && <div className='mt-3 h-px w-full bg-divider' />}
      {voters.map((voter, i) => {
        const person = (
          <>
            <Avatar size={30} url={voter.avatarUrl} color={voter.avatarColor} firstname={voter.firstname} lastname={voter.lastname} />
            <span className='min-w-0 flex-1 truncate text-text-3 font-bold text-heading'>
              {[voter.firstname, voter.lastname].filter(Boolean).join(' ')}
            </span>
          </>
        )
        return (
          <div key={voter.id} className='flex flex-col'>
            <div className='flex h-[50px] items-center gap-3'>
              {onOpen && voter.id !== userId ? (
                <button type='button' onClick={() => onOpen(voter)} className='flex min-w-0 flex-1 items-center gap-3 text-left transition-opacity duration-(--duration-press) ease-ios active:opacity-60'>
                  {person}
                </button>
              ) : (
                person
              )}
            </div>
            {i < voters.length - 1 && <div className='h-px w-full bg-divider' />}
          </div>
        )
      })}
    </div>
  )
}
