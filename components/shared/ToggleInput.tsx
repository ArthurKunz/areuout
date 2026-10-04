'use client'

import Toggle from './Toggle'

// A single label/switch row, 50px tall — same shape as InputRow, but a
// Toggle instead of a text field.
export function ToggleInputRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className='flex h-[50px] items-center justify-between px-4'>
      <span className='text-text-3 font-semibold text-heading'>{label}</span>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

// The 50px-tall (at most 350px wide) pill used for a single toggle field in the redesign (e.g.
// Endzeit).
export default function ToggleInput(props: Parameters<typeof ToggleInputRow>[0]) {
  return (
    <div className='w-full max-w-[350px] rounded-full bg-main backdrop-blur-[100px]'>
      <ToggleInputRow {...props} />
    </div>
  )
}
