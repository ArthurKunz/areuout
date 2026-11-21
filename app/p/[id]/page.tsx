import type { Metadata } from 'next'
import GuestLinkScreen from '@/features/explore/GuestLinkScreen'

export const metadata: Metadata = {
  title: 'Eine Party auf areuout',
  description: 'Öffne den Link mit der areuout-App.',
}

// Public like the invite link (proxy.ts). The party id in the path is not used here; the
// iOS app reads it when the Universal Link opens there.
export default function GuestLinkPage() {
  return <GuestLinkScreen />
}
