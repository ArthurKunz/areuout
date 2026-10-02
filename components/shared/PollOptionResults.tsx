'use client'

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
  voters: { id: string; avatarUrl: string; name: string }[]
}) {
  return (
    <div className='flex w-[350px] flex-col rounded-[25px] bg-main p-4 backdrop-blur-[100px]'>
      <div className='flex items-center justify-between'>
        <span className='text-text-2 font-bold text-heading'>{label}</span>
        <span className='text-text-2 text-text'>{votes} Votes</span>
      </div>
      {voters.length > 0 && <div className='mt-3 h-px w-full bg-divider' />}
      {voters.map((voter, i) => (
        <div key={voter.id} className='flex flex-col'>
          <div className='flex h-[50px] items-center gap-3'>
            <img src={voter.avatarUrl} alt='' className='h-[30px] w-[30px] shrink-0 rounded-full object-cover' />
            <span className='min-w-0 flex-1 truncate text-text-3 font-bold text-heading'>{voter.name}</span>
          </div>
          {i < voters.length - 1 && <div className='h-px w-full bg-divider' />}
        </div>
      ))}
    </div>
  )
}
