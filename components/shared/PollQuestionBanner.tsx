'use client'

// The pill at the top of the poll results page, showing the question above
// the per-option result blocks. Same bg-main + 100px blur as the other info
// cards.
export default function PollQuestionBanner({ question }: { question: string }) {
  return (
    <div className='flex min-h-[50px] w-full items-center rounded-[25px] bg-main px-4 py-3 glass-field'>
      <span className='min-w-0 break-words text-text-2 font-semibold text-heading'>{question}</span>
    </div>
  )
}
