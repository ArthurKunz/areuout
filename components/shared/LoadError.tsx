'use client'

import { CircleAlert, RotateCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/shared/Alert'
import BigButton from '@/components/shared/BigButton'

// A list or page that could not load (step 12 review): the red Alert with the screen's
// own sentence and a retry, where the content would be. Before, a native alert() came
// first and then an empty text that claimed there was nothing to show. The retry words
// are the ones app/error.tsx uses; the caller shows its skeleton again and reloads.
export default function LoadError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className='flex flex-col items-center gap-3'>
      <Alert>
        <CircleAlert />
        <AlertTitle>Das ging nicht</AlertTitle>
        <AlertDescription>{text}</AlertDescription>
      </Alert>
      <BigButton variant='main' onClick={onRetry}>
        <span className='flex items-center gap-2'>
          <RotateCw size={20} strokeWidth={2.5} />
          nochmal versuchen
        </span>
      </BigButton>
    </div>
  )
}
