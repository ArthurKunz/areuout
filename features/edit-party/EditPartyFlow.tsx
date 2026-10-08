'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import StepFrame from '@/features/create-party/StepFrame'
import { TimeFields, PickerRow, cardClass } from '@/features/create-party/steps/TimeStep'
import LocationStep from '@/features/create-party/steps/LocationStep'
import CoverStep from '@/features/create-party/steps/CoverStep'
import { FeatureChips } from '@/features/create-party/steps/FeaturesStep'
import SingleFieldStep from '@/features/create-party/features/SingleFieldStep'
import DescriptionStep from '@/features/create-party/features/DescriptionStep'
import QuestionsStep from '@/features/create-party/features/QuestionsStep'
import PollsStep from '@/features/create-party/features/PollsStep'
import type { Feature } from '@/features/create-party/features/FeatureChip'
import { LIMITS, canLeaveName, canLeaveTime, type PartyDraft } from '@/features/create-party/draft'
import ToggleInput from '@/components/shared/ToggleInput'
import Input from '@/components/shared/Input'
import { getDetailPolls } from '@/features/parties/services/pools.service'
import { supabase } from '@/lib/supabase/client'
import { alertError } from '@/lib/utils'
import { toEditDraft } from './editDraft'
import { saveEdit } from './saveEdit'

type Screen = 'form' | 'location' | 'cover' | { sub: Feature }

const divider = <div className='mx-4 h-px rounded-full bg-divider' />

// Edit Party (App Redesign 7.7): one form with every field instead of the five create
// steps, built from the Create Party pieces — the Öffentlich toggle row, Name, the time
// rows and wheels, Location and Partycover as rows that open the create sub-screens,
// and the feature chips with their sub-screens. Back returns to the party's detail
// without saving; speichern writes everything in one update_party call.
export default function EditPartyFlow({ partyId, userId }: { partyId: string; userId: string }) {
  const router = useRouter()
  const [draft, setDraft] = useState<PartyDraft | null>(null)
  // The picture the party points at now; replaced by an own upload, it is removed after
  // a successful save.
  const [oldBackgroundUrl, setOldBackgroundUrl] = useState('')
  const [screen, setScreen] = useState<Screen>('form')
  const [saving, setSaving] = useState(false)

  const toDetail = () => router.push(`/hosting?party=${encodeURIComponent(partyId)}`)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.rpc('get_party_detail', { p_event_id: partyId }).maybeSingle(),
      getDetailPolls(partyId),
    ]).then(([detail, polls]) => {
      if (cancelled) return
      const error = detail.error ?? polls.error
      if (error || !detail.data) {
        alertError('Die Party konnte nicht geladen werden.', error?.message)
        router.replace('/hosting')
        return
      }
      // Only the host edits; RLS would refuse the save anyway.
      if (detail.data.host_id !== userId) {
        router.replace('/hosting')
        return
      }
      setOldBackgroundUrl(detail.data.background_url)
      setDraft(toEditDraft(detail.data, polls.data ?? { polls: [], questions: [] }))
    })
    return () => {
      cancelled = true
    }
  }, [partyId, userId, router])

  // An uploaded cover's preview URL lives as long as it is the cover, as in
  // CreatePartyFlow.
  const previewUrl = draft?.cover?.kind === 'upload' ? draft.cover.previewUrl : null
  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  if (!draft) {
    return (
      <StepFrame title='Party bearbeiten' onBack={toDetail} button={null}>
        {[0, 1, 2].map((i) => (
          <div key={i} className='h-[50px] w-full max-w-[350px] rounded-[25px] skeleton' />
        ))}
      </StepFrame>
    )
  }

  const update = (patch: Partial<PartyDraft>) => setDraft((current) => (current ? { ...current, ...patch } : current))
  const toForm = () => setScreen('form')

  // On success the detail opens again with the saved party; Hosting flies the map to
  // it. On failure saveEdit has already said why, and the form stays filled.
  const save = async () => {
    if (saving) return
    setSaving(true)
    const ok = await saveEdit(draft, partyId, userId, oldBackgroundUrl)
    if (!ok) {
      setSaving(false)
      return
    }
    router.replace(`/hosting?party=${encodeURIComponent(partyId)}`)
  }

  if (screen === 'location') {
    return (
      <LocationStep
        draft={draft}
        onPick={(location) => {
          update({ location })
          toForm()
        }}
        onBack={toForm}
      />
    )
  }
  if (screen === 'cover') {
    return <CoverStep draft={draft} update={update} onNext={toForm} onBack={toForm} buttonLabel='fertig' />
  }
  if (typeof screen === 'object') {
    const sub = {
      draft,
      onSave: (patch: Partial<PartyDraft>) => {
        update(patch)
        toForm()
      },
      onBack: toForm,
    }
    switch (screen.sub) {
      case 'motto':
      case 'maxGuests':
      case 'dresscode':
      case 'price':
        return <SingleFieldStep field={screen.sub} {...sub} />
      case 'description':
        return <DescriptionStep {...sub} />
      case 'questions':
        return <QuestionsStep {...sub} />
      case 'polls':
        return <PollsStep {...sub} />
    }
  }

  const coverUrl =
    draft.cover?.kind === 'upload' ? draft.cover.previewUrl : draft.cover ? draft.cover.url : null

  return (
    <StepFrame
      title='Party bearbeiten'
      onBack={toDetail}
      button={{ label: 'speichern', onClick: save, disabled: saving || !canLeaveName(draft) || !canLeaveTime(draft) }}
    >
      <ToggleInput label='Öffentlich' checked={draft.isPublic} onChange={(isPublic) => update({ isPublic })} />
      <Input
        label='Name'
        value={draft.title}
        onChange={(title) => update({ title })}
        placeholder='z.B. Hausparty'
        maxLength={LIMITS.title}
      />
      <TimeFields draft={draft} update={update} />
      <div className={cardClass}>
        <PickerRow label='Location' value={draft.location?.label ?? ''} onClick={() => setScreen('location')} />
        {divider}
        <button type='button' onClick={() => setScreen('cover')} className='flex h-[50px] w-full items-center justify-between gap-3 px-4'>
          <span className='shrink-0 text-text-3 font-semibold text-heading'>Partycover</span>
          {coverUrl && <img src={coverUrl} alt='' className='size-8 rounded-full object-cover' />}
        </button>
      </div>
      <FeatureChips draft={draft} update={update} onOpen={(feature) => setScreen({ sub: feature })} />
    </StepFrame>
  )
}
