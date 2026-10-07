'use client'

import { Search } from 'lucide-react'

// The 50px-tall (at most 350px wide) search pill used for the location search. Typed text uses
// text-text (white 50%), the placeholder text-input (white 25%) — same
// tokens as the other inputs, just both visible at once here since the
// icon sits up front instead of a trailing label.
export default function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
}) {
  return (
    <div className='flex h-[50px] w-full max-w-[350px] items-center gap-3 rounded-full bg-main px-4 glass-control'>
      <Search size={25} className='shrink-0 text-heading' />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className='min-w-0 flex-1 bg-transparent text-text-2 font-semibold text-text outline-none placeholder:text-input'
      />
    </div>
  )
}
