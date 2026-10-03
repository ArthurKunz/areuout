'use client'

// A single label/value row, 50px tall. Shared by Input (one row, fully rounded)
// and InputGroup (several rows stacked in one container with dividers).
export function InputRow({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  maxLength,
  inputMode,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  type?: 'text' | 'number'
  maxLength?: number
  inputMode?: 'text' | 'numeric'
}) {
  return (
    <div className='flex h-[50px] items-center gap-3 px-4'>
      <span className='shrink-0 text-text-3 font-semibold text-heading'>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        className='min-w-0 flex-1 bg-transparent text-right text-text-3 text-text outline-none placeholder:text-input'
      />
    </div>
  )
}

// The 350x50 pill used for a single text field in the redesign.
export default function Input(props: Parameters<typeof InputRow>[0]) {
  return (
    <div className='w-[350px] rounded-full bg-main backdrop-blur-[100px]'>
      <InputRow {...props} />
    </div>
  )
}
