'use client'

// The 64x27 switch used on its own, outside a Switch row (see Switch.tsx).
export default function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label?: string
}) {
  return (
    <button
      type='button'
      role='switch'
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[27px] w-[64px] shrink-0 rounded-full transition-colors duration-200 ${
        checked ? 'bg-green' : 'bg-button-toggle-off'
      }`}
    >
      <span
        className={`absolute top-[1.5px] h-[24px] w-[38px] rounded-full bg-main-white transition-[left] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          checked ? 'left-[24.5px]' : 'left-[1.5px]'
        }`}
      />
    </button>
  )
}
