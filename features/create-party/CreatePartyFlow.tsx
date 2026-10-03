'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import StepFrame from './StepFrame'
import NameStep from './steps/NameStep'
import TimeStep from './steps/TimeStep'
import LocationStep from './steps/LocationStep'
import CoverStep from './steps/CoverStep'
import { emptyDraft, type PartyDraft } from './draft'

type FeatureStep = 'motto' | 'maxGuests' | 'dresscode' | 'description' | 'polls' | 'questions'
type Screen = 1 | 2 | 3 | 4 | 5 | { sub: FeatureStep }

// The whole create flow on one route: the steps are client state, not routes, so there
// is no jumping between them and a refresh starts over (App Redesign 7.1). `from` is
// the tab it was opened from, already checked by the page; ✗ returns there.
export default function CreatePartyFlow({ from }: { from: string }) {
  const router = useRouter()
  const [draft, setDraft] = useState<PartyDraft>(emptyDraft)
  const [screen, setScreen] = useState<Screen>(1)

  const close = () => router.push(from)
  const update = (patch: Partial<PartyDraft>) => setDraft((current) => ({ ...current, ...patch }))

  // An uploaded cover's preview URL lives as long as it is the cover: revoked once a
  // preset or another picture replaces it, or the flow closes. Not on a step change,
  // since the flow and its draft stay mounted throughout.
  const previewUrl = draft.cover?.kind === 'upload' ? draft.cover.previewUrl : null
  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  // Placeholders remain for the steps still to come; each is replaced by its step component.
  if (typeof screen === 'object') return null
  switch (screen) {
    case 1:
      return <NameStep draft={draft} update={update} onNext={() => setScreen(2)} onClose={close} />
    case 2:
      return <TimeStep draft={draft} update={update} onNext={() => setScreen(3)} onBack={() => setScreen(1)} onClose={close} />
    case 3:
      return (
        <LocationStep
          draft={draft}
          onPick={(location) => {
            update({ location })
            setScreen(4)
          }}
          onBack={() => setScreen(2)}
          onClose={close}
        />
      )
    case 4:
      return <CoverStep draft={draft} update={update} onNext={() => setScreen(5)} onBack={() => setScreen(3)} onClose={close} />
    case 5:
      return (
        <StepFrame title='Features' onClose={close} onBack={() => setScreen(4)} button={{ label: 'Erstellen', onClick: () => {} }}>
          {null}
        </StepFrame>
      )
  }
}
