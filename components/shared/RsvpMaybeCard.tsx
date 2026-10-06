'use client'

// The 167x108 "Vielleicht" stat tile on the guest list page: yellow badge
// top left with a question mark, label and value anchored to the bottom.
// Same bg-main + 100px blur as DateCard/MottoCard. The "?" glyph matches
// RsvpStatusButton's maybe state rather than a Lucide icon.
export default function RsvpMaybeCard({ value }: { value: number }) {
  return (
    <div className='flex h-[108px] w-[167px] flex-col rounded-[25px] bg-main p-4 backdrop-blur-[100px]'>
      <span className='flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-yellow'>
        <span className='text-[18px] font-bold leading-none text-main-white'>?</span>
      </span>
      <div className='mt-2 flex flex-col'>
        <span className='text-text-2 font-semibold text-heading'>Vielleicht</span>
        <span className='text-text-3 text-text'>{value}</span>
      </div>
    </div>
  )
}
