'use client'

import { useEffect, useTransition } from 'react'
import Link from 'next/link'
import { RotateCw } from 'lucide-react'
import Spinner from '@/components/shared/Spinner'
import StatusScreen, { statusButtonClass } from '@/components/shared/StatusScreen'

// Error boundaries have to be client components. This one wraps everything below
// the root layout; an error IN the root layout would need global-error instead.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  // retry re-fetches, which can take as long as the request that failed. React owns
  // the pending flag, so it ends by itself whether the retry succeeds or throws again.
  const [retrying, startRetry] = useTransition()

  // A server error reaches the client as a generic message plus a digest, so the
  // console is the only place the digest can be read back from.
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <StatusScreen
      emoji='🫠'
      title='Da ist was schiefgelaufen'
      text='Die Seite konnte nicht geladen werden. Versuch es nochmal — meistens reicht das schon.'
    >
      <button
        type='button'
        onClick={() => startRetry(() => retry())}
        disabled={retrying}
        className={statusButtonClass}
      >
        {retrying ? <Spinner /> : <><RotateCw size={20} strokeWidth={2.5} />nochmal versuchen</>}
      </button>

      <Link href='/' className='text-label-2 text-subheading'>
        zur Startseite
      </Link>
    </StatusScreen>
  )
}
