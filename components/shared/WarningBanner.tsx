import { TriangleAlert } from 'lucide-react'
import Collapse from '@/components/shared/Collapse'

// The app's one warning surface: a red hairline box with a lucide TriangleAlert.
// Introduced for the "nearly full" notice on the party pages, shared from there.
// It unfolds when it appears instead of shoving everything below it in one frame
// (step 11d). By height, through Collapse: the banner is blurred, and a fade would
// leave it flat while it played.
export default function WarningBanner({ message }: { message: string }) {
  return (
    <Collapse open appear className='w-full'>
      <div className='flex w-full items-center justify-center gap-2 rounded-xl border-border border-warning/60 bg-warning/15 backdrop-blur-xl px-4 py-3'>
        <TriangleAlert size={18} strokeWidth={2} className='text-warning shrink-0' />
        <span className='text-subheading-1 text-warning text-center'>{message}</span>
      </div>
    </Collapse>
  )
}
