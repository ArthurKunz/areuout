'use client'

// A pill (at most 350px wide) with equal segments, one of them selected (öffentlich · privat on the
// first create step). Same track as Input; the thumb slides between segments with the
// easing of the navigation's selector instead of jumping.
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  const activeIndex = options.findIndex((option) => option.value === value)

  return (
    <div role='radiogroup' className='relative flex h-[50px] w-full max-w-[350px] rounded-full bg-main p-1 backdrop-blur-[100px]'>
      {activeIndex >= 0 && (
        <span
          aria-hidden
          className='absolute inset-y-1 left-1 rounded-full bg-selector transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none'
          style={{
            width: `calc((100% - 0.5rem) / ${options.length})`,
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        />
      )}
      {options.map((option) => (
        <button
          key={option.value}
          type='button'
          role='radio'
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className='relative flex flex-1 items-center justify-center text-text-3 font-semibold text-heading'
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
