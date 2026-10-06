'use client'

import { Check, ChevronRight, List } from 'lucide-react'

// The poll tile on the event detail page: violet list badge top left, the
// question, one selectable row per option with a vote-share bar, then a
// divider and a "Votes anzeigen" row in the brand colour. Same bg-main +
// 100px blur as the other info cards; height grows with the option count.
export default function PollCard({
  question,
  options,
  selectedIndex,
  onSelect,
  onShowVotesClick,
}: {
  question: string
  options: { label: string; percent: number }[]
  selectedIndex: number | null
  onSelect: (index: number) => void
  onShowVotesClick?: () => void
}) {
  return (
    <div className='flex w-[350px] flex-col rounded-[25px] bg-main p-4 backdrop-blur-[100px]'>
      <span className='flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-violet'>
        <List size={18} className='text-main-white' />
      </span>
      <span className='mt-2 text-text-2 font-semibold text-heading'>{question}</span>

      <div className='mt-4 flex flex-col gap-4'>
        {options.map((option, i) => {
          const selected = i === selectedIndex
          return (
            <div key={option.label} className='flex items-center gap-3'>
              <button
                type='button'
                onClick={() => onSelect(i)}
                aria-label={option.label}
                className={`flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full ${
                  selected ? 'bg-brand' : 'border border-main-white'
                }`}
              >
                {selected && <Check size={12} strokeWidth={3} className='text-main-white' />}
              </button>
              <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
                <span className='text-text-2 font-medium text-text'>{option.label}</span>
                <div className='h-1.5 w-full rounded-full bg-progress-track'>
                  <div className='h-full rounded-full bg-brand' style={{ width: `${option.percent}%` }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className='mt-4 flex flex-col gap-3'>
        <div className='h-px w-full bg-divider' />
        <button
          type='button'
          onClick={onShowVotesClick}
          className='flex items-center justify-between text-text-2 font-medium text-brand'
        >
          <span>Votes anzeigen</span>
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  )
}
