'use client'

import { useState, useEffect, useRef, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, ImagePlus, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { alertError, generateInviteCode, getOrigin } from '@/lib/utils'
import { stripMetadataAndResize, BACKGROUND_MAX_EDGE } from '@/lib/image'
import AddressSearchField from './components/AddressSearchField'
import PartyDateSheet from './components/PartyDateSheet'
import PartyTimeSheet from './components/PartyTimeSheet'
import CreateStepLayout from './components/CreateStepLayout'
import FloatingEmojis from './components/FloatingEmojis'
import { cardClass, primaryButtonClass, RowDivider, rowClass, rowInputClass, rowLabelClass, rowValueClass } from '@/components/shared/Card'
import PoolDraftForm from './components/PoolDraftForm'
import PoolDraftCard from './components/PoolDraftCard'
import Switch from '@/components/shared/Switch'
import Collapse from '@/components/shared/Collapse'
import WarningBanner from '@/components/shared/WarningBanner'
import { createParty } from './services/parties.service'
import { createPool, addPoolOption } from './services/pools.service'
import type { CreatePartyFormValues, PoolDraft } from './types/parties.types'

const BG_MAX_BYTES = 10 * 1024 * 1024

// The bucket is still called event-backgrounds; only the app renamed events to parties.
const BG_BUCKET = 'event-backgrounds'

// The title is `text-heading-1` (35px semibold) on the party page and must not wrap:
// roughly 18px per character across 343px of content leaves about 19, so 20.
const TITLE_MAX = 20
const DESCRIPTION_MAX = 500
const GUESTS_MAX = 500
const POOLS_MAX = 5
// Matches Collapse's duration: a deleted poll folds away before it is dropped.
const COLLAPSE_MS = 300

// Ready-made party backgrounds from /public: picking one writes its path straight
// into parties.background_url, so nothing is uploaded.
const BG_PRESETS = Array.from({ length: 8 }, (_, i) => `/backgrounds/bg-${i + 1}.jpg`)

type StepId = 'name' | 'description' | 'date' | 'time' | 'location' | 'guests' | 'background' | 'pools' | 'done'

// Background sits with the other required answers (name, date, time, location) and
// ahead of the optional ones, since it is the only later step that cannot be skipped.
const STEPS: StepId[] = ['name', 'date', 'time', 'location', 'background', 'description', 'guests', 'pools', 'done']
const QUESTION_COUNT = STEPS.length - 1

const HEADLINES: Record<StepId, string> = {
  name: 'Wie nennst du deine Party?',
  description: 'Worum geht es?',
  date: 'An welchem Tag steigt die Party?',
  time: 'Um wie viel Uhr findet die Party statt?',
  location: 'Wo findet sie statt?',
  guests: 'Wie viele Gäste?',
  background: 'Hintergrundbild',
  pools: 'Umfragen hinzufügen',
  done: 'Deine Party ist bereit! 🎉',
}

// The eight wallpapers are ~1.1MB together and arrive one at a time, so each tile
// shimmers until ITS OWN image has decoded and then cross-fades it in — the same
// treatment the party hero and PartyCard give their images. It has to be a component
// rather than inline markup: the loaded flag is per-tile, and state cannot live
// inside the parent's map.
function PresetTile({
  url,
  index,
  selected,
  onSelect,
}: {
  url: string
  index: number
  selected: boolean
  onSelect: () => void
}) {
  const [loaded, setLoaded] = useState(false)

  return (
    <button type='button' onClick={onSelect} className='flex flex-col items-center gap-2'>
      <div
        className={`relative aspect-[3/2] w-full overflow-hidden rounded-[18px] transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95 ${
          loaded ? '' : 'skeleton'
        }`}
      >
        <img
          src={url}
          alt={`Hintergrund ${index + 1}`}
          onLoad={() => setLoaded(true)}
          className={`h-full w-full object-cover transition-opacity duration-500 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full backdrop-blur-xl transition-colors duration-200 ${
          selected ? 'bg-link' : 'border border-white/30'
        }`}
      >
        {selected && <Check size={14} strokeWidth={3} className='text-white' />}
      </span>
    </button>
  )
}

export default function CreatePartyScreen() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [step, setStep] = useState<StepId>('name')
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [showPoolForm, setShowPoolForm] = useState(false)
  const [editingPool, setEditingPool] = useState<PoolDraft | null>(null)
  const [localPools, setLocalPools] = useState<PoolDraft[]>([])
  const [removingPoolId, setRemovingPoolId] = useState<string | null>(null)
  const removePoolTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [bgPreset, setBgPreset] = useState<string | null>(null)
  const [locationPicked, setLocationPicked] = useState(false)
  const [hasEndTime, setHasEndTime] = useState(false)
  const [dateSheetOpen, setDateSheetOpen] = useState(false)
  const [timeSheet, setTimeSheet] = useState<'start' | 'end' | null>(null)
  const [bgFile, setBgFile] = useState<File | null>(null)
  const [bgPreviewUrl, setBgPreviewUrl] = useState<string | null>(null)
  const [bgPreviewLoaded, setBgPreviewLoaded] = useState(false)
  const [bgError, setBgError] = useState<string | null>(null)
  const [values, setValues] = useState<CreatePartyFormValues>({
    title: '',
    description: '',
    day: '',
    month: '',
    year: '',
    hour: '',
    minute: '',
    end_hour: '',
    end_minute: '',
    location: '',
    city: '',
    max_guests: '',
  })

  useEffect(() => () => clearTimeout(removePoolTimer.current), [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push('/login')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .maybeSingle()
      if (!profile) {
        router.push('/onboarding')
        return
      }
      setUserId(session.user.id)
    })
  }, [router])

  const stepIndex = STEPS.indexOf(step)
  const shareLink = inviteCode ? `${getOrigin()}/e/${inviteCode}` : ''

  const setField = (field: keyof CreatePartyFormValues, value: string) =>
    setValues((v) => ({ ...v, [field]: value }))

  const canContinue = (() => {
    switch (step) {
      case 'name':
        return values.title.trim().length > 0
      case 'date':
        return Boolean(values.day && values.month && values.year)
      case 'time':
        return Boolean(
          values.hour && values.minute && (!hasEndTime || (values.end_hour && values.end_minute)),
        )
      case 'location':
        // Typed text is never enough: the answer has to be a picked suggestion, so
        // every party ends up on an address a guest can actually be sent to.
        return locationPicked && values.location.trim().length > 0
      default:
        return true
    }
  })()

  const handlePickBg = (picked: File | null) => {
    setBgError(null)
    if (!picked) return
    if (!picked.type.startsWith('image/')) {
      setBgError('Bitte ein Bild (JPG, PNG, …) auswählen.')
      return
    }
    if (picked.size > BG_MAX_BYTES) {
      setBgError('Die Datei darf höchstens 10 MB groß sein.')
      return
    }
    setBgPreset(null)
    setBgFile(picked)
    // A phone photo is big enough to take a moment to decode, so the box shimmers
    // until this new one is actually on screen.
    setBgPreviewLoaded(false)
    setBgPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(picked)
    })
  }

  const handleFinish = async () => {
    if (!userId || creating) return
    setCreating(true)

    const code = generateInviteCode()
    // Both columns are timestamptz and the database session runs in UTC, so a naive
    // `2026-08-15T19:00:00` would be READ AS 19:00 UTC and come back as 21:00 in
    // Germany. The picked wall-clock time is therefore built as a real local Date and
    // sent as an ISO string, which carries the offset — the same thing `ends_at` was
    // already doing, which is why the two columns used to disagree by two hours.
    const start = new Date(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      0,
      0
    )
    const event_date = start.toISOString()

    // The end time is optional, so the column simply stays null without one.
    let ends_at: string | null = null
    if (values.end_hour) {
      // An end earlier than the start means the party runs past midnight.
      const end = new Date(start)
      end.setHours(Number(values.end_hour), Number(values.end_minute), 0, 0)
      if (end <= start) end.setDate(end.getDate() + 1)
      ends_at = end.toISOString()
    }
    const max_guests = values.max_guests ? parseInt(values.max_guests, 10) : null

    const { data, error } = await createParty({
      host_id: userId,
      title: values.title.trim(),
      description: values.description.trim() || null,
      invite_code: code,
      event_date,
      ends_at,
      // The city only exists when a suggestion was picked; a hand-typed address
      // must not end up stored with a dangling comma.
      location: [values.location.trim(), values.city.trim()].filter(Boolean).join(', '),
      max_guests,
    })

    if (error || !data) {
      alertError('Deine Party konnte nicht erstellt werden.', error?.message)
      setCreating(false)
      return
    }

    const newPartyId = data.id

    if (bgPreset) {
      await supabase.from('events').update({ background_url: bgPreset }).eq('id', newPartyId)
    } else if (bgFile) {
      // A party background is a photo of somewhere real, so it carries the same
      // coordinates an avatar does — and this bucket is just as readable. Never the
      // picked file, always the re-encoded one.
      const cleanBg = await stripMetadataAndResize(bgFile, BACKGROUND_MAX_EDGE).catch(() => null)

      if (!cleanBg) {
        // The party is already saved, so this is a warning about the picture and
        // nothing else — same rule as the failed upload below.
        alertError('Dein Hintergrundbild konnte nicht verarbeitet werden. Die Party wurde trotzdem erstellt.')
      } else {
        const path = `${userId}/${newPartyId}/background.jpg`
        // 'event-backgrounds', not 'party-backgrounds': the event->party rename swept
        // through this string too, but the BUCKET kept its name, so every upload since
        // has failed against a bucket that does not exist.
        const { error: uploadError } = await supabase.storage
          .from(BG_BUCKET)
          .upload(path, cleanBg, { cacheControl: '3600', upsert: true })
        if (uploadError) {
          // It used to be swallowed, which is how the broken bucket stayed invisible.
          alertError('Dein Hintergrundbild konnte nicht hochgeladen werden. Die Party wurde trotzdem erstellt.', uploadError.message)
        } else {
          const { data: urlData } = supabase.storage.from(BG_BUCKET).getPublicUrl(path)
          await supabase.from('events').update({ background_url: urlData.publicUrl }).eq('id', newPartyId)
        }
      }
    }

    // Die Party steht an dieser Stelle schon, eine gescheiterte Umfrage darf den Ablauf
    // also nicht abbrechen — dieselbe Regel wie beim Hintergrundbild darüber. Gemeldet
    // werden muss sie aber: vorher lief diese Schleife bei einem Fehler stillschweigend
    // weiter, und der Gastgeber bekam eine Party mit zwei statt drei Umfragen, ohne
    // dass irgendwo etwas stand.
    //
    // Gesammelt und einmal am Ende gemeldet, nicht pro Umfrage: POOLS_MAX ist 5, das
    // wären sonst fünf Dialoge hintereinander.
    const failedPools: string[] = []

    for (const pool of localPools) {
      const { data: poolData, error: poolError } = await createPool({
        event_id: newPartyId,
        question: pool.question,
        description: pool.description,
        type: 'options',
        allow_text_response: false,
        allow_multiple: pool.allow_multiple,
      })

      if (poolError || !poolData) {
        failedPools.push(pool.question)
        continue
      }

      // Eine Umfrage ohne ihre Antwortmöglichkeiten ist unbrauchbar, also zählt eine
      // halb angelegte genauso als gescheitert wie eine, die gar nicht entstand.
      const optionResults = await Promise.all(
        pool.options.map((label, i) => addPoolOption(poolData.id, label, i))
      )
      if (optionResults.some((result) => result.error)) failedPools.push(pool.question)
    }

    if (failedPools.length > 0) {
      alertError(
        failedPools.length === 1
          ? `Die Umfrage „${failedPools[0]}“ konnte nicht angelegt werden. Die Party wurde trotzdem erstellt — du kannst die Umfrage beim Bearbeiten nachtragen.`
          : `${failedPools.length} Umfragen konnten nicht angelegt werden. Die Party wurde trotzdem erstellt — du kannst sie beim Bearbeiten nachtragen.`
      )
    }

    setInviteCode(code)
    setCreated(true)
    setCreating(false)
    goToStep('done')
  }

  // The page scrolls, and the tall steps (background, pools) are usually left
  // scrolled down — without this the next question opens halfway down itself.
  // Jumped rather than smooth-scrolled: the content swaps in the same frame, so an
  // animated scroll would be gliding over a page that is already the new one.
  const goToStep = (next: StepId) => {
    setStep(next)
    window.scrollTo({ top: 0 })
  }

  // Folded away first and dropped afterwards, so the list closes the gap instead of
  // snapping shut. The card slides itself out to the left over the same 300ms.
  const removePool = (id: string) => {
    if (removingPoolId) return
    setRemovingPoolId(id)
    removePoolTimer.current = setTimeout(() => {
      setLocalPools((prev) => prev.filter((p) => p.id !== id))
      setRemovingPoolId(null)
    }, COLLAPSE_MS)
  }

  // The poll form is a page of its own, so it opens and closes at the top for the
  // same reason a step does — the list it is reached from is usually scrolled.
  const openPoolForm = (draft: PoolDraft | null) => {
    setEditingPool(draft)
    setShowPoolForm(true)
    window.scrollTo({ top: 0 })
  }

  const closePoolForm = () => {
    setShowPoolForm(false)
    setEditingPool(null)
    window.scrollTo({ top: 0 })
  }

  const handleNext = () => {
    if (step === 'pools') {
      void handleFinish()
      return
    }
    goToStep(STEPS[stepIndex + 1])
  }

  const handleSelectStep = (index: number) => {
    // Locked once the party exists; before that any question can be revisited.
    if (created) return
    goToStep(STEPS[index])
  }

  const handleEnterAdvance = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !canContinue) return
    e.preventDefault()
    handleNext()
  }

  const handleCopy = async () => {
    if (!shareLink) return
    try {
      await navigator.clipboard.writeText(shareLink)
    } catch {
      const el = document.createElement('textarea')
      el.value = shareLink
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!userId) return null

  // Rebuilt steps go through the shared shell; the rest still use the old markup
  // below until their own stage lands.
  const skipStep = () => setStep(STEPS[stepIndex + 1])

  const pad = (n: number) => String(n).padStart(2, '0')
  const today = new Date()
  const dateValue = {
    day: Number(values.day) || today.getDate(),
    month: Number(values.month) ? Number(values.month) - 1 : today.getMonth(),
    year: Number(values.year) || today.getFullYear(),
  }
  const setDate = (next: { day: number; month: number; year: number }) =>
    setValues((v) => ({ ...v, day: pad(next.day), month: pad(next.month + 1), year: String(next.year) }))
  const formattedDate = values.day
    ? new Date(Number(values.year), Number(values.month) - 1, Number(values.day)).toLocaleDateString('de-DE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''

  const timeValue = (which: 'start' | 'end') => ({
    hour: Number(which === 'start' ? values.hour : values.end_hour) || (which === 'start' ? 20 : 2),
    minute: Number(which === 'start' ? values.minute : values.end_minute) || 0,
  })
  const setTime = (which: 'start' | 'end', next: { hour: number; minute: number }) =>
    setValues((v) =>
      which === 'start'
        ? { ...v, hour: pad(next.hour), minute: pad(next.minute) }
        : { ...v, end_hour: pad(next.hour), end_minute: pad(next.minute) },
    )

  // The wheel opens on a default, and that default is what the user sees — so it
  // counts as the answer straight away. Closing without scrolling keeps it instead
  // of falling back to the placeholder.
  const openDateSheet = () => {
    setDate(dateValue)
    setDateSheetOpen(true)
  }
  const openTimeSheet = (which: 'start' | 'end') => {
    setTime(which, timeValue(which))
    setTimeSheet(which)
  }

  const toggleEndTime = (next: boolean) => {
    setHasEndTime(next)
    // Switching it back off must not leave a stale end time behind for handleFinish.
    if (!next) setValues((v) => ({ ...v, end_hour: '', end_minute: '' }))
  }

  // Only the step's own content is swapped — the background below it is rendered
  // once, outside this, so the emojis carry on drifting from wherever they are
  // instead of respawning at the bottom on every step and on the finish screen.
  const renderStep = () => {
  if (step === 'pools') {
    if (showPoolForm) {
      return (
        <PoolDraftForm
          draft={editingPool ?? undefined}
          onCancel={closePoolForm}
          onAdd={(draft) => {
            // The form hands back the id it was opened on, so an edit replaces its
            // poll in place and a new one lands at the end.
            setLocalPools((prev) =>
              prev.some((p) => p.id === draft.id)
                ? prev.map((p) => (p.id === draft.id ? draft : p))
                : [...prev, draft],
            )
            closePoolForm()
          }}
        />
      )
    }

    return (
      <CreateStepLayout
        headline={HEADLINES.pools}
        onCancel={() => router.push('/parties')}
        onSkip={() => void handleFinish()}
        onPrimary={handleNext}
        busy={creating}
        // Grows with every poll added, so a pinned bar would end up sitting on the
        // list it belongs to.
        pinnedControls={false}
        stepCount={QUESTION_COUNT}
        currentStep={stepIndex}
        onSelectStep={handleSelectStep}
      >
        {/* Everything added so far, as an overview: tap to edit, swipe to delete.
            Its own column with no gap — a collapsed card is still a flex item, so a
            gap here would leave a hole where a deleted poll used to be. The spacing
            rides inside each box instead and folds away with it. */}
        <div className='flex flex-col'>
          {localPools.map((pool) => (
            <Collapse key={pool.id} open={pool.id !== removingPoolId}>
              <div className='pb-3'>
                <PoolDraftCard
                  pool={pool}
                  deleting={pool.id === removingPoolId}
                  onEdit={() => openPoolForm(pool)}
                  onDelete={() => removePool(pool.id)}
                />
              </div>
            </Collapse>
          ))}
        </div>

        {/* At the cap the row is replaced by the reason, rather than left there
            looking tappable. */}
        {localPools.length >= POOLS_MAX ? (
          <WarningBanner message={`Maximal ${POOLS_MAX} Umfragen`} />
        ) : (
          <div className={cardClass}>
            <button type='button' onClick={() => openPoolForm(null)} className={rowClass}>
              <span className='flex h-6 w-6 items-center justify-center rounded-full bg-success'>
                <Plus size={16} strokeWidth={3} className='text-white' />
              </span>
              <span className='text-button text-label-large'>Umfrage hinzufügen</span>
            </button>
          </div>
        )}
      </CreateStepLayout>
    )
  }

  if (step === 'background') {
    return (
      <CreateStepLayout
        headline={HEADLINES.background}
        onCancel={() => router.push('/parties')}
        onPrimary={handleNext}
        primaryDisabled={!bgFile && !bgPreset}
        // Long enough that a pinned bar would cover the wallpapers it is asking
        // about: here the button waits at the end of the page instead.
        pinnedControls={false}
        stepCount={QUESTION_COUNT}
        currentStep={stepIndex}
        onSelectStep={handleSelectStep}
      >
        <label className='block w-full cursor-pointer'>
          <div
            className={`flex aspect-[2/1] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-[25px] bg-secondary backdrop-blur-xl ${
              bgPreviewUrl && !bgPreviewLoaded ? 'skeleton' : ''
            }`}
          >
            {bgPreviewUrl ? (
              <img
                src={bgPreviewUrl}
                alt=''
                onLoad={() => setBgPreviewLoaded(true)}
                className={`h-full w-full object-cover transition-opacity duration-500 ${
                  bgPreviewLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ) : (
              <>
                <div className='flex h-12.5 w-12.5 items-center justify-center rounded-full bg-tertiary backdrop-blur-xl'>
                  <ImagePlus size={22} strokeWidth={2} className='text-heading' />
                </div>
                <div className='flex flex-col items-center gap-0.5 px-6 text-center'>
                  <span className='text-button text-label-large'>Eigenes Bild hochladen</span>
                  <span className='text-label-2 text-subheading'>JPG oder PNG, bis 10 MB</span>
                </div>
              </>
            )}
          </div>
          <input type='file' accept='image/*' className='hidden' onChange={(e) => handlePickBg(e.target.files?.[0] ?? null)} />
        </label>

        {bgError && <span className='px-4 text-label-2 text-warning'>{bgError}</span>}

        <div className='grid grid-cols-2 gap-3'>
          {BG_PRESETS.map((url, i) => (
            <PresetTile
              key={url}
              url={url}
              index={i}
              selected={bgPreset === url}
              onSelect={() => {
                setBgPreset(url)
                setBgFile(null)
                setBgPreviewUrl((prev) => {
                  if (prev) URL.revokeObjectURL(prev)
                  return null
                })
              }}
            />
          ))}
        </div>
      </CreateStepLayout>
    )
  }

  if (step === 'location') {
    return (
      <CreateStepLayout
        headline={HEADLINES.location}
        onCancel={() => router.push('/parties')}
        onPrimary={handleNext}
        primaryDisabled={!canContinue}
        stepCount={QUESTION_COUNT}
        currentStep={stepIndex}
        onSelectStep={handleSelectStep}
      >
        <AddressSearchField
          value={values.location}
          // Typing by hand invalidates the city — and the pick — that the last
          // suggestion brought with it.
          onChange={(address) => {
            setLocationPicked(false)
            setValues((v) => ({ ...v, location: address, city: '' }))
          }}
          onSelect={(result) => {
            setLocationPicked(true)
            setValues((v) => ({ ...v, location: result.street, city: result.city }))
          }}
        />
      </CreateStepLayout>
    )
  }

  if (step === 'date' || step === 'time') {
    return (
      <>
        <CreateStepLayout
          headline={HEADLINES[step]}
          onCancel={() => router.push('/parties')}
          onPrimary={handleNext}
          primaryDisabled={!canContinue}
          stepCount={QUESTION_COUNT}
          currentStep={stepIndex}
          onSelectStep={handleSelectStep}
        >
          {step === 'date' ? (
            <div className={cardClass}>
              {/* The whole row is the tap target; the input is only here so the
                  value and placeholder read exactly like the Name step's. */}
              <button type='button' onClick={openDateSheet} className={rowClass}>
                <span className={rowLabelClass}>Datum</span>
                <input
                  type='text'
                  readOnly
                  tabIndex={-1}
                  value={formattedDate}
                  placeholder='auswählen'
                  className={`${rowInputClass} pointer-events-none`}
                />
              </button>
            </div>
          ) : (
            <>
              <div className={cardClass}>
                {/* Same shape as the Datum row: the row is the tap target, the input
                    only carries the Name step's value and placeholder colours. */}
                <button type='button' onClick={() => openTimeSheet('start')} className={rowClass}>
                  <span className={rowLabelClass}>beginnt um…</span>
                  <input
                    type='text'
                    readOnly
                    tabIndex={-1}
                    value={values.hour ? `${values.hour}:${values.minute}` : ''}
                    placeholder='auswählen'
                    className={`${rowInputClass} pointer-events-none`}
                  />
                </button>
                {/* Unfolds out of the card rather than appearing in it, so the
                    switch below visibly makes room for it. */}
                <Collapse open={hasEndTime}>
                  <RowDivider />
                  <button type='button' onClick={() => openTimeSheet('end')} className={rowClass}>
                    <span className={rowLabelClass}>endet um…</span>
                    <input
                      type='text'
                      readOnly
                      tabIndex={-1}
                      value={values.end_hour ? `${values.end_hour}:${values.end_minute}` : ''}
                      placeholder='auswählen'
                      className={`${rowInputClass} pointer-events-none`}
                    />
                  </button>
                </Collapse>
              </div>

              <Switch label='Endzeitpunkt hinzufügen' checked={hasEndTime} onChange={toggleEndTime} />
            </>
          )}
        </CreateStepLayout>

        {dateSheetOpen && (
          <PartyDateSheet value={dateValue} onChange={setDate} onClose={() => setDateSheetOpen(false)} />
        )}
        {timeSheet && (
          <PartyTimeSheet
            value={timeValue(timeSheet)}
            onChange={(next) => setTime(timeSheet, next)}
            onClose={() => setTimeSheet(null)}
          />
        )}
      </>
    )
  }

  if (step === 'name' || step === 'description' || step === 'guests') {
    return (
      <CreateStepLayout
        headline={HEADLINES[step]}
        onCancel={() => router.push('/parties')}
        onSkip={step === 'name' ? undefined : skipStep}
        onPrimary={handleNext}
        primaryDisabled={!canContinue}
        stepCount={QUESTION_COUNT}
        currentStep={stepIndex}
        onSelectStep={handleSelectStep}
      >
        {step === 'name' && (
          <>
            <div className={cardClass}>
              <div className={rowClass}>
                <span className={rowLabelClass}>Name</span>
                <input
                  type='text'
                  value={values.title}
                  onChange={(e) => setField('title', e.target.value)}
                  onKeyDown={handleEnterAdvance}
                  placeholder='z.B. Sommerparty'
                  enterKeyHint='next'
                  maxLength={TITLE_MAX}
                  className={rowInputClass}
                />
              </div>
            </div>
            {values.title.length >= TITLE_MAX && (
              <WarningBanner message={`Maximal ${TITLE_MAX} Zeichen`} />
            )}
          </>
        )}

        {step === 'description' && (
          <>
            <div className={`${cardClass} p-4`}>
              <textarea
                value={values.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder='Details'
                rows={4}
                maxLength={DESCRIPTION_MAX}
                className='w-full resize-none bg-transparent text-button text-subheading outline-none'
              />
            </div>
            {values.description.length >= DESCRIPTION_MAX && (
              <WarningBanner message={`Maximal ${DESCRIPTION_MAX} Zeichen`} />
            )}
          </>
        )}

        {step === 'guests' && (
          <>
            <div className={cardClass}>
              <div className={rowClass}>
                <span className={rowLabelClass}>Max. Gäste</span>
                <input
                  type='text'
                  inputMode='numeric'
                  value={values.max_guests}
                  // Typing past the cap clamps to it rather than being swallowed, so
                  // the number on screen is always the one that will be saved.
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
                    setField('max_guests', Number(digits) > GUESTS_MAX ? String(GUESTS_MAX) : digits)
                  }}
                  onKeyDown={handleEnterAdvance}
                  placeholder='z.B. 50'
                  enterKeyHint='next'
                  className={rowInputClass}
                />
              </div>
            </div>
            {Number(values.max_guests) >= GUESTS_MAX && (
              <WarningBanner message={`Maximal ${GUESTS_MAX} Gäste`} />
            )}
          </>
        )}
      </CreateStepLayout>
    )
  }

  // Every question has its own branch above, so what is left is the finish screen.
  // It carries no ✕, no skip and no dots, but keeps the questions' frame: headline at
  // the top, answer and button at the bottom.
  return (
    <div className='relative z-10 flex min-h-dvh flex-col px-4 pt-26.25 pb-safe-rsvp'>
      <span className='mb-7.5 animate-fade-in-up text-center text-heading-2 font-bold text-heading'>
        {HEADLINES.done}
      </span>

      <div className='mt-auto w-full'>
        <div className={cardClass}>
          <div className={rowClass}>
            <span className={rowLabelClass}>Einladungslink</span>

            {/* The link is longer than the row, so it FADES OUT under the copy button
                instead of being cut off. A gradient overlay would not do it here — the
                card is translucent, so painting `bg-secondary` over the text only dims
                it; masking makes the text itself transparent, on any background. */}
            <div className='ml-auto min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,#000_65%,transparent)] [-webkit-mask-image:linear-gradient(to_right,#000_65%,transparent)]'>
              <span className={`block whitespace-nowrap ${rowValueClass}`}>{shareLink}</span>
            </div>

            <button
              type='button'
              onClick={handleCopy}
              aria-label='Einladungslink kopieren'
              className='flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full bg-sheet text-sheet-heading transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-90'
            >
              {copied ? <Check size={16} strokeWidth={3} /> : <Copy size={15} strokeWidth={2.5} />}
            </button>
          </div>
        </div>

        <button
          type='button'
          onClick={() => router.push('/parties')}
          className={`${primaryButtonClass} mt-3`}
        >
          Fertig
        </button>
      </div>
    </div>
  )
  }

  return (
    <div className='relative w-full min-h-dvh bg-main'>
      <FloatingEmojis active />
      {renderStep()}
    </div>
  )
}
