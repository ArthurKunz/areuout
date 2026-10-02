'use client'

// The pill at the top of the poll results page, showing the question above
// the per-option result blocks. Same bg-main + 100px blur as the other info
// cards.
export default function PollQuestionBanner({ question }: { question: string }) {
  return (
    <div className='flex h-[50px] w-[350px] items-center rounded-full bg-main px-4 backdrop-blur-[100px]'>
      <span className='text-text-2 font-bold text-heading'>{question}</span>
    </div>
  )
}
