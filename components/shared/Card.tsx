// The label/value row pattern, shared by the profile settings pages and the
// create-party flow so the two cannot drift. Rows are 50px tall and the card's
// radius is half that, which makes a one-row card a pill.
export const cardClass = 'w-full rounded-[25px] bg-secondary backdrop-blur-xl overflow-hidden'
export const rowClass =
  'flex h-12.5 w-full items-center gap-3 px-4 transition-colors duration-150 active:bg-white/10'
export const rowLabelClass = 'text-button text-label-large shrink-0'
export const rowValueClass = 'text-button text-subheading'
export const rowInputClass = `ml-auto min-w-0 flex-1 bg-transparent text-right outline-none ${rowValueClass}`
export const primaryButtonClass =
  'flex h-12.5 w-full items-center justify-center rounded-full bg-sheet backdrop-blur-xl text-button font-semibold text-sheet-heading transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95 disabled:bg-sheet/40 disabled:text-sheet-heading/60'

// Hairline between two rows, inset so it starts under the label.
export const RowDivider = () => (
  <div className='flex px-4'>
    <div className='h-[0.75px] w-full bg-white/10' />
  </div>
)
