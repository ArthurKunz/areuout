import { LoaderIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// shadcn's Spinner, ported by hand: lucide's LoaderIcon turning, for waits too short or
// too shapeless for a skeleton (a button saving, an upload running).
//
// Colour comes from the parent's text colour (the icon strokes in currentColor), so it
// works on the white pills and on the dark surfaces without a prop. Size through a
// size-* class; size-5 is the 20px the old spinner had, so no button changes height.
// With reduced motion it turns at half speed instead of stopping: a frozen loader
// reads as broken, and iOS keeps its own indicator running there too.
export default function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <LoaderIcon
      role='status'
      aria-label='Lädt'
      className={cn('size-5 shrink-0 animate-spin motion-reduce:[animation-duration:2s]', className)}
      {...props}
    />
  )
}
