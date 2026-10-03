'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import NameStep from './steps/NameStep'
import TimeStep from './steps/TimeStep'
import LocationStep from './steps/LocationStep'
import CoverStep from './steps/CoverStep'
import FeaturesStep from './steps/FeaturesStep'
import SingleFieldStep from './features/SingleFieldStep'
import DescriptionStep from './features/DescriptionStep'
import QuestionsStep from './features/QuestionsStep'
import PollsStep from './features/PollsStep'
import type { Feature } from './features/FeatureChip'
import { emptyDraft, type PartyDraft } from './draft'

type Screen = 1 | 2 | 3 | 4 | 5 | { sub: Feature }

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

  // A feature sub-step returns to step 5 either way: back discards its local copy,
  // Hinzufügen writes it first.
  const toFeatures = () => setScreen(5)
  const sub = {
    draft,
    onSave: (patch: Partial<PartyDraft>) => {
      update(patch)
      toFeatures()
    },
    onBack: toFeatures,
  }

  const key = typeof screen === 'object' ? screen.sub : screen
  switch (key) {
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
        <FeaturesStep
          draft={draft}
          update={update}
          onOpen={(feature) => setScreen({ sub: feature })}
          // Saving comes in the next phase; until then Erstellen does nothing.
          onCreate={() => {}}
          saving={false}
          onBack={() => setScreen(4)}
          onClose={close}
        />
      )
    case 'motto':
    case 'maxGuests':
    case 'dresscode':
      return <SingleFieldStep field={key} {...sub} />
    case 'description':
      return <DescriptionStep {...sub} />
    case 'questions':
      return <QuestionsStep {...sub} />
    case 'polls':
      return <PollsStep {...sub} />
  }
}
