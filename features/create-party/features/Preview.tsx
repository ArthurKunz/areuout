// Read-only twins of InputRow for the Umfrage and Frage list screens (mockups Create
// 12 and 13): the label left, the saved value right in grey, both in the same classes
// as the editable rows so a preview looks like the form it came from.
export function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex h-[50px] items-center gap-3 px-4'>
      <span className='shrink-0 text-text-3 font-semibold text-heading'>{label}</span>
      <span className='min-w-0 flex-1 truncate text-right text-text-3 text-text'>{value}</span>
    </div>
  )
}

export const previewDivider = <div className='mx-4 h-px rounded-full bg-divider' />

// The surface behind a preview: a card for a poll, a pill (same radius at one row) for
// a question.
export const previewSurface = 'w-full max-w-[350px] rounded-[25px] bg-main backdrop-blur-[100px]'
