'use client'

// The 350px-wide location search results list: one 50px row per address,
// divided the same way as InputGroup. Plain nav rows — no chevron, no
// value, just the address.
export default function LocationResultsList({
  results,
}: {
  results: { id: string; label: string; onClick?: () => void }[]
}) {
  return (
    <div className='flex w-[350px] flex-col rounded-[25px] bg-main backdrop-blur-[100px]'>
      {results.map((result, i) => (
        <div key={result.id}>
          {i > 0 && <div className='mx-4 h-px rounded-full bg-divider' />}
          <button
            type='button'
            onClick={result.onClick}
            className='flex h-[50px] w-full items-center px-4 text-left text-text-2 font-semibold text-heading'
          >
            {result.label}
          </button>
        </div>
      ))}
    </div>
  )
}
