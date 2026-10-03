'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import StepFrame from './StepFrame'
import { emptyDraft, type PartyDraft } from './draft'

type FeatureStep = 'motto' | 'maxGuests' | 'dresscode' | 'description' | 'polls' | 'questions'
type Screen = 1 | 2 | 3 | 4 | 5 | { sub: FeatureStep }

// The whole create flow on one route: the steps are client state, not routes, so there
// is no jumping between them and a refresh starts over (App Redesign 7.1). `from` is
// the tab it was opened from, already checked by the page; ✗ returns there.
export default function CreatePartyFlow({ from }: { from: string }) {
  const router = useRouter()
  // Read and written by the steps once they replace the placeholders below.
  const [draft, setDraft] = useState<PartyDraft>(emptyDraft)
  const [screen, setScreen] = useState<Screen>(1)

  const close = () => router.push(from)

  // Placeholders until the steps arrive; each case is replaced by its step component.
  if (typeof screen === 'object') return null
  switch (screen) {
    case 1:
      return (
        <StepFrame title='Party erstellen' onClose={close} button={{ label: 'Weiter', onClick: () => setScreen(2) }}>
          {null}
        </StepFrame>
      )
    case 2:
      return (
        <StepFrame title='Time' onClose={close} onBack={() => setScreen(1)} button={{ label: 'Weiter', onClick: () => setScreen(3) }}>
          {null}
        </StepFrame>
      )
    case 3:
      return (
        <StepFrame title='Location' onClose={close} onBack={() => setScreen(2)} button={{ label: 'Weiter', onClick: () => setScreen(4) }}>
          {null}
        </StepFrame>
      )
    case 4:
      return (
        <StepFrame title='Partycover' onClose={close} onBack={() => setScreen(3)} button={{ label: 'weiter', onClick: () => setScreen(5) }}>
          {null}
        </StepFrame>
      )
    case 5:
      return (
        <StepFrame title='Features' onClose={close} onBack={() => setScreen(4)} button={{ label: 'Erstellen', onClick: () => {} }}>
          {null}
        </StepFrame>
      )
  }
}
