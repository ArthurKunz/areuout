'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { alertError } from '@/lib/utils'
import Spinner from '@/components/shared/Spinner'
import WarningBanner from '@/components/shared/WarningBanner'
import UnsavedChangesDialog from '@/components/shared/UnsavedChangesDialog'
import {
  cardClass,
  rowClass,
  rowInputClass,
  rowLabelClass,
  rowValueClass,
  RowDivider,
  primaryButtonClass,
} from '@/components/shared/Card'
import SettingsPage from '@/features/profile/components/SettingsPage'
import Collapse from '@/components/shared/Collapse'
import Switch from '@/components/shared/Switch'
import FloatingEmojis from './components/FloatingEmojis'
import PoolDraftCard from './components/PoolDraftCard'
import PoolDraftForm from './components/PoolDraftForm'
import AddressSearchField from './components/AddressSearchField'
import BackgroundPicker from './components/BackgroundPicker'
import PartyDateSheet, { type PartyDate } from './components/PartyDateSheet'
import PartyTimeSheet, { type PartyTime } from './components/PartyTimeSheet'
import { getPartyById, updateParty, updatePartyBackground, deletePool } from './services/parties.service'
import {
  getPartyPools,
  createPool,
  updatePool,
  addPoolOption,
  updatePoolOption,
  deletePoolOption,
} from './services/pools.service'
import { getPartyAttendees } from './services/parties.service'

import { BG_BUCKET, BG_MAX_BYTES, BG_PRESETS } from './constants/background.constants'
import { stripMetadataAndResize, BACKGROUND_MAX_EDGE } from '@/lib/image'
import { removeStorageFileByUrl } from '@/lib/storage'
import { supabase as db } from '@/lib/supabase/client'

import type { Pool, PoolDraft } from './types/parties.types'

const TITLE_MAX = 20
const POOLS_MAX = 5
// Matches Collapse's duration: a removed poll folds away before it is dropped.
const COLLAPSE_MS = 300

const toDraft = (pool: Pool): PoolDraft => ({
  id: pool.id,
  question: pool.question,
  description: pool.description,
  options: pool.options.map((o) => o.label),
  allow_multiple: pool.allow_multiple,
})
const DESCRIPTION_MAX = 500
const GUESTS_MAX = 500

const pad = (n: number) => String(n).padStart(2, '0')

// The end is a clock time, not a date: an end earlier than the start means the party
// runs past midnight, exactly as the create flow builds it. Both the stored value and
// the edited one go through this, so an untouched end re-serialises to what is saved.
const endIsoFrom = (start: Date, end: PartyTime | null): string | null => {
  if (!end) return null
  const d = new Date(start)
  d.setHours(end.hour, end.minute, 0, 0)
  if (d <= start) d.setDate(d.getDate() + 1)
  return d.toISOString()
}

// These rows are `text-right` while the input still spans the whole remaining width,
// so almost every tap lands in the empty space to the LEFT of the value and drops the
// caret at position 0 — you end up typing in front of the 50 instead of behind it.
// The rAF matters: iOS places its own caret from the tap after focus has fired, so
// setting the selection synchronously would simply be overwritten.
const caretToEnd = (e: React.FocusEvent<HTMLInputElement>) => {
  const el = e.currentTarget
  requestAnimationFrame(() => {
    const end = el.value.length
    el.setSelectionRange(end, end)
  })
}

export default function EditPartyScreen({ partyId }: { partyId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [askLeave, setAskLeave] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  // Getrennt gehalten wie im Erstellen-Flow: die Suche liefert Strasse und Stadt
  // einzeln, gespeichert wird die Zusammensetzung. Beim Laden wird am LETZTEN Komma
  // geteilt — dieselbe Regel, mit der beide Party-Screens die Adresse anzeigen.
  const [city, setCity] = useState('')
  // Hintergrund: was gespeichert ist, und was der Gastgeber gerade gewählt hat. Beides
  // getrennt, weil erst beim Speichern hochgeladen wird — und weil die alte Datei erst
  // sterben darf, wenn die Zeile auf die neue zeigt.
  // Fuer den Speicherpfad des Hintergrunds gebraucht. Es ist immer die eigene Id —
  // wer nicht Gastgeber ist, wird beim Laden weggeschickt.
  const [hostId, setHostId] = useState<string | null>(null)
  const [storedBg, setStoredBg] = useState<string | null>(null)
  const [bgPreset, setBgPreset] = useState<string | null>(null)
  const [bgFile, setBgFile] = useState<File | null>(null)
  const [bgObjectUrl, setBgObjectUrl] = useState<string | null>(null)
  const [bgError, setBgError] = useState<string | null>(null)
  const [maxGuests, setMaxGuests] = useState('')
  const [date, setDate] = useState<PartyDate>({ day: 1, month: 0, year: new Date().getFullYear() })
  const [time, setTime] = useState<PartyTime>({ hour: 20, minute: 0 })
  // 02:00 is the create flow's default for a party that has an end at all.
  const [endTime, setEndTime] = useState<PartyTime>({ hour: 2, minute: 0 })
  const [hasEndTime, setHasEndTime] = useState(false)

  // What is stored, so an unchanged form cannot be saved and the back button knows
  // whether there is anything to ask about.
  const [stored, setStored] = useState('')
  const [dateOpen, setDateOpen] = useState(false)
  const [timeOpen, setTimeOpen] = useState(false)
  const [endOpen, setEndOpen] = useState(false)
  const [guestCount, setGuestCount] = useState(0)

  // Polls live here, not on a page of their own, because nothing about them is
  // written until this screen is saved — and a working copy cannot survive a route
  // change. `loadedPools` is what the database holds; `poolDrafts` is what the host
  // has made of it, and the difference between the two is what save has to apply.
  const [view, setView] = useState<'main' | 'pools' | 'poolform' | 'location' | 'background'>('main')
  const [loadedPools, setLoadedPools] = useState<Pool[]>([])
  const [poolDrafts, setPoolDrafts] = useState<PoolDraft[]>([])
  const [editingPool, setEditingPool] = useState<PoolDraft | null>(null)
  const [poolsLoading, setPoolsLoading] = useState(true)
  const [removingPoolId, setRemovingPoolId] = useState<string | null>(null)
  const removePoolTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return
      if (!session) {
        router.push('/login')
        return
      }
      const party = await getPartyById(partyId)
      if (cancelled) return
      // Only the host edits. The screens behind the two rows check the same thing,
      // and RLS refuses the writes either way — this is what keeps a guest from
      // seeing a form that could only ever fail.
      if (!party || party.host_id !== session.user.id) {
        router.push(`/parties/${partyId}`)
        return
      }

      const start = new Date(party.event_date)
      setTitle(party.title)
      setDescription(party.description ?? '')
      setHostId(session.user.id)
      setStoredBg(party.background_url ?? null)
      // Ist der gespeicherte Wert eines der acht Motive, steht sein Haken von Anfang
      // an richtig. Ein hochgeladenes Bild ist keine Vorauswahl, sondern eine Datei.
      setBgPreset(party.background_url && BG_PRESETS.includes(party.background_url) ? party.background_url : null)

      const komma = party.location.lastIndexOf(',')
      setLocation(komma === -1 ? party.location : party.location.slice(0, komma).trim())
      setCity(komma === -1 ? '' : party.location.slice(komma + 1).trim())
      setMaxGuests(party.max_guests != null ? String(party.max_guests) : '')
      setDate({ day: start.getDate(), month: start.getMonth(), year: start.getFullYear() })
      setTime({ hour: start.getHours(), minute: start.getMinutes() })
      const end = party.ends_at ? new Date(party.ends_at) : null
      const storedEnd = end ? { hour: end.getHours(), minute: end.getMinutes() } : null
      setHasEndTime(storedEnd !== null)
      if (storedEnd) setEndTime(storedEnd)
      // The stored date has to go through the SAME construction as the edited one,
      // or the two never match: Postgres hands back '…T18:00:00+00:00' while
      // toISOString() writes '…T18:00:00.000Z'. Comparing those two strings marked
      // the form as changed the moment it loaded, so leaving it always asked.
      const storedStart = new Date(
        start.getFullYear(), start.getMonth(), start.getDate(), start.getHours(), start.getMinutes(), 0, 0
      )
      setStored(
        JSON.stringify({
          title: party.title.trim(),
          description: (party.description ?? '').trim(),
          location: party.location.trim(),
          maxGuests: party.max_guests != null ? String(party.max_guests) : '',
          iso: storedStart.toISOString(),
          endIso: endIsoFrom(storedStart, storedEnd),
        })
      )
      setLoading(false)

      void getPartyPools(partyId).then((p) => {
        if (cancelled) return
        setLoadedPools(p)
        setPoolDrafts(p.map(toDraft))
        setPoolsLoading(false)
      })
      void getPartyAttendees(partyId).then((a) => !cancelled && setGuestCount(a.filter((x) => x.status === 'going').length))
    })

    return () => {
      cancelled = true
      clearTimeout(removePoolTimer.current)
    }
  }, [partyId, router])

  const startDate = new Date(date.year, date.month, date.day, time.hour, time.minute, 0, 0)
  const endIso = endIsoFrom(startDate, hasEndTime ? endTime : null)
  // Dieselbe Zusammensetzung wie im Erstellen-Flow, inklusive des filter(Boolean):
  // eine handgetippte Adresse ohne Stadt darf kein baumelndes Komma bekommen.
  const fullLocation = [location.trim(), city.trim()].filter(Boolean).join(', ')
  // Was in der Zeile steht. Ein Motiv bekommt seine Nummer, alles andere heisst so,
  // wie es ist — eine hochgeladene Datei hat keinen Namen, den man zeigen wollte.
  const backgroundLabel = bgFile
    ? 'Eigenes Bild'
    : bgPreset
      ? `Motiv ${BG_PRESETS.indexOf(bgPreset) + 1}`
      : storedBg
        ? 'Eigenes Bild'
        : 'Keins'
  const current = JSON.stringify({
    title: title.trim(),
    description: description.trim(),
    location: fullLocation,
    maxGuests,
    iso: startDate.toISOString(),
    endIso,
  })
  // Polls are part of the same unsaved work, so they belong in the same question the
  // back button asks.
  const poolsChanged = JSON.stringify(poolDrafts) !== JSON.stringify(loadedPools.map(toDraft))
  // Der Hintergrund ebenso. Eine gewaehlte Datei ist immer eine Aenderung; ein Motiv
  // nur, wenn es ein anderes ist als das gespeicherte.
  const backgroundChanged = bgFile !== null || (bgPreset !== null && bgPreset !== storedBg)
  const changed = !loading && (current !== stored || poolsChanged || backgroundChanged)
  // Der Kapazitaets-Trigger auf rsvps prueft nur beim Zusagen, nie beim Aendern der
  // Grenze. Ohne diese Regel liesse sich die Gaestezahl unter die Zahl der bereits
  // Zugesagten senken — die Party stuende dann auf '8 von 3', und niemand fliegt
  // dadurch raus. Die Zahl der Zusagen liegt hier ohnehin schon vor, sie steht in der
  // Zeile darunter auf dem Schirm.
  const maxGuestsBelowGoing = maxGuests !== '' && parseInt(maxGuests, 10) < guestCount
  const canSave =
    changed && title.trim().length > 0 && fullLocation.length > 0 && !maxGuestsBelowGoing

  // Dieselben Pruefungen wie im Erstellen-Flow, Wort fuer Wort: Typ und Groesse. Das
  // eigentliche Entfernen der Kameradaten passiert erst beim Speichern — hier wird nur
  // gewaehlt.
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
    setBgObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(picked)
    })
  }

  const removePool = (id: string) => {
    if (removingPoolId) return
    setRemovingPoolId(id)
    removePoolTimer.current = setTimeout(() => {
      setPoolDrafts((prev) => prev.filter((p) => p.id !== id))
      setRemovingPoolId(null)
    }, COLLAPSE_MS)
  }

  // Everything the host did to the polls, turned into the smallest set of writes.
  // Options are matched by position and RENAMED rather than replaced: option_id is
  // ON DELETE SET NULL, so dropping one to rename it would detach every vote on it.
  //
  // Gibt zurück, wie viele Umfragen NICHT durchgingen. Vorher verschluckte diese
  // Funktion jeden einzelnen Fehler und handleSave navigierte anschließend trotzdem
  // weiter — der Gastgeber sah also seine Änderungen verschwinden, ohne dass irgendwo
  // etwas stand. Beim Anlegen ist ein solcher Fehler ärgerlich, hier ist er schlimmer:
  // wer auf „speichern“ drückt, erwartet, dass gespeichert wurde.
  const savePools = async (): Promise<number> => {
    let failed = 0
    const keptIds = new Set(poolDrafts.map((d) => d.id))

    const deletions = await Promise.all(
      loadedPools.filter((p) => !keptIds.has(p.id)).map((p) => deletePool(p.id))
    )
    failed += deletions.filter((result) => result.error).length

    for (const d of poolDrafts) {
      const existing = loadedPools.find((p) => p.id === d.id)

      if (!existing) {
        const { data, error } = await createPool({
          event_id: partyId,
          question: d.question,
          description: d.description,
          type: 'options',
          allow_text_response: false,
          allow_multiple: d.allow_multiple,
        })
        if (error || !data) {
          failed++
          continue
        }
        // Eine Umfrage ohne Antwortmöglichkeiten ist unbrauchbar, also zählt eine halb
        // angelegte genauso als gescheitert.
        const options = await Promise.all(d.options.map((label, i) => addPoolOption(data.id, label, i)))
        if (options.some((result) => result.error)) failed++
        continue
      }

      if (JSON.stringify(toDraft(existing)) === JSON.stringify(d)) continue

      const { error: updateError } = await updatePool(existing.id, {
        question: d.question,
        description: d.description,
        allow_multiple: d.allow_multiple,
      })
      if (updateError) {
        failed++
        continue
      }

      const old = existing.options
      // null steht für die Optionen, die unverändert blieben und deshalb gar nicht
      // erst geschrieben wurden — die können auch nicht scheitern.
      const optionWrites = await Promise.all([
        ...d.options
          .slice(0, old.length)
          .map((label, i) =>
            label === old[i].label && old[i].position === i
              ? Promise.resolve(null)
              : updatePoolOption(old[i].id, label, i)
          ),
        ...old.slice(d.options.length).map((o) => deletePoolOption(o.id)),
        ...d.options.slice(old.length).map((label, i) => addPoolOption(existing.id, label, old.length + i)),
      ])
      if (optionWrites.some((result) => result !== null && result.error)) failed++
    }

    return failed
  }

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    const { error } = await updateParty(partyId, {
      title: title.trim(),
      description: description.trim() || null,
      location: fullLocation,
      max_guests: maxGuests ? parseInt(maxGuests, 10) : null,
      event_date: startDate.toISOString(),
      ends_at: endIso,
    })
    if (error) {
      setSaving(false)
      alertError('Die Party konnte nicht gespeichert werden.', error.message)
      return
    }
    // Der Hintergrund NACH den Feldern: die Party ist an dieser Stelle gespeichert,
    // ein misslungener Upload darf den Rest nicht mitreissen — dieselbe Regel wie im
    // Erstellen-Flow.
    let bgFailed = false
    if (backgroundChanged) {
      let neueAdresse: string | null = bgPreset

      if (bgFile && hostId) {
        // Niemals die gewaehlte Datei, immer die neu kodierte: ein Partyfoto traegt
        // dieselben Koordinaten wie ein Avatar.
        const clean = await stripMetadataAndResize(bgFile, BACKGROUND_MAX_EDGE).catch(() => null)
        if (!clean) {
          bgFailed = true
          neueAdresse = null
        } else {
          // Zeitstempel im Namen, wie beim Avatar. Ein fester Name waere derselbe URL,
          // und der Zwischenspeicher lieferte danach stundenlang das alte Bild aus.
          const path = `${hostId}/${partyId}/background-${Date.now()}.jpg`
          const { error: uploadError } = await db.storage
            .from(BG_BUCKET)
            .upload(path, clean, { cacheControl: '3600', upsert: false })
          if (uploadError) {
            bgFailed = true
            neueAdresse = null
          } else {
            neueAdresse = db.storage.from(BG_BUCKET).getPublicUrl(path).data.publicUrl
          }
        }
      }

      if (neueAdresse) {
        const { error: bgError2 } = await updatePartyBackground(partyId, neueAdresse)
        if (bgError2) {
          bgFailed = true
        } else {
          // Erst jetzt darf das alte Bild sterben — und nur, wenn es eine hochgeladene
          // Datei war. Die acht Motive liegen in /public und gehoeren keiner Party.
          if (storedBg && !BG_PRESETS.includes(storedBg)) {
            await removeStorageFileByUrl(BG_BUCKET, storedBg)
          }
          setStoredBg(neueAdresse)
        }
      }
    }

    const failedPools = await savePools()
    setSaving(false)

    if (bgFailed) {
      alertError('Dein Hintergrundbild konnte nicht gespeichert werden. Die übrigen Änderungen sind gespeichert.')
    }

    // Die Felder der Party sind zu diesem Zeitpunkt gespeichert; nur an den Umfragen
    // hat etwas nicht geklappt. Weiternavigiert wird trotzdem — auf der Detailseite
    // sieht der Gastgeber den tatsächlichen Stand und kann gezielt nachbessern. Hier
    // stehenzubleiben wäre schlechter: savePools vergleicht gegen den beim Öffnen
    // geladenen Stand, ein zweiter Versuch würde die bereits angelegten Umfragen also
    // ein zweites Mal anlegen.
    if (failedPools > 0) {
      alertError(
        failedPools === 1
          ? 'Eine Umfrage konnte nicht gespeichert werden. Alle anderen Änderungen wurden übernommen.'
          : `${failedPools} Umfragen konnten nicht gespeichert werden. Alle anderen Änderungen wurden übernommen.`
      )
    }

    router.push(`/parties/${partyId}`)
  }

  const handleBack = () => {
    if (canSave) {
      setAskLeave(true)
      return
    }
    router.push(`/parties/${partyId}`)
  }

  const chevron = <ChevronRight size={18} strokeWidth={2.5} className='shrink-0 text-arrow' />

  // The poll form carries its draft back on the chevron instead of offering a
  // Speichern of its own — see the `commit` prop. Nothing reaches the database until
  // this screen is saved, so a second save button here would promise more than it does.
  if (view === 'poolform') {
    return (
      // PoolDraftForm brings no background of its own — in the create flow it sits
      // inside the same shell, which is why it looks right there and looked bare here.
      <div className='relative w-full min-h-dvh bg-main'>
        <FloatingEmojis active />
        <PoolDraftForm
          commit='onBack'
          draft={editingPool ?? undefined}
          onCancel={() => {
            setEditingPool(null)
            setView('pools')
          }}
          onAdd={(d) => {
            setPoolDrafts((prev) =>
              prev.some((p) => p.id === d.id) ? prev.map((p) => (p.id === d.id ? d : p)) : [...prev, d]
            )
            setEditingPool(null)
            setView('pools')
          }}
        />
      </div>
    )
  }

  // Die Adresssuche als eigene Unteransicht, genau wie die Umfragen eine ist. Zwei
  // Gruende gegen ein Sheet: AddressSearchField zeichnet seine Karte mit
  // backdrop-blur-xl, und ein SheetLayout ist laut eigenem Kommentar OPAK — ein
  // blurrendes Element auf einem undurchsichtigen Grund ist genau das, wovor CLAUDE.md
  // warnt. Auf dem Seitenhintergrund steht es dagegen so, wie es im Erstellen-Flow
  // entworfen wurde.
  //
  // mt-auto haengt das Feld an den unteren Rand: die Vorschlagsliste klappt nach OBEN
  // auf, damit der beste Treffer am naechsten an der Eingabe liegt. Dieselbe Anordnung
  // benutzt die Umfragen-Ansicht darunter.
  if (view === 'location') {
    return (
      <SettingsPage title='Location' fill onBack={() => setView('main')}>
        <div className='mt-auto flex w-full flex-col gap-3'>
          <AddressSearchField
            value={location}
            // Von Hand tippen macht die Stadt der letzten Auswahl ungueltig — sonst
            // stuende hinter einer frei getippten Strasse noch die alte Stadt.
            onChange={(address) => {
              setLocation(address)
              setCity('')
            }}
            onSelect={(result) => {
              setLocation(result.street)
              setCity(result.city)
              setView('main')
            }}
          />
        </div>
      </SettingsPage>
    )
  }

  // Der Bildwaehler des Erstellen-Flows, dieselbe Komponente. Oben im Kasten steht,
  // was die Party bekommen wird: das gewaehlte Foto, sonst das gewaehlte Motiv, sonst
  // der Hintergrund, den sie schon hat.
  if (view === 'background') {
    return (
      <SettingsPage title='Hintergrund' fill onBack={() => setView('main')}>
        <div className='flex w-full flex-col gap-3'>
          <BackgroundPicker
            previewUrl={bgObjectUrl ?? bgPreset ?? storedBg}
            selectedPreset={bgPreset}
            error={bgError}
            onPickFile={handlePickBg}
            onSelectPreset={(url) => {
              setBgPreset(url)
              setBgFile(null)
              setBgObjectUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev)
                return null
              })
            }}
          />
        </div>
      </SettingsPage>
    )
  }

  if (view === 'pools') {
    return (
      <SettingsPage title='Umfragen' fill onBack={() => setView('main')}>
        {/* The create flow's poll step, arrangement and all: the answer block hangs
            from the bottom (`mt-auto`) with the add row last, and the page simply
            grows upward when there are more polls than fit. The only thing missing
            is the 'weiter' button, because there is no next step to go to. */}
        <div className='mt-auto flex w-full flex-col gap-3'>
        {poolsLoading ? (
          // A poll card is one 50px row per question plus one per option, so two
          // options make 150px — the placeholder is that, twice.
          <div className='flex flex-col gap-3'>
            <div className='h-37.5 w-full rounded-[25px] skeleton' />
            <div className='h-37.5 w-full rounded-[25px] skeleton' />
          </div>
        ) : (
        <>
        {/* Its own column with no gap — a collapsed card is still a flex item, so a
            gap would leave a hole where a deleted poll used to be. */}
        <div className='flex flex-col'>
          {poolDrafts.map((pool) => (
            <Collapse key={pool.id} open={pool.id !== removingPoolId}>
              <div className='pb-3'>
                <PoolDraftCard
                  pool={pool}
                  deleting={pool.id === removingPoolId}
                  onEdit={() => {
                    setEditingPool(pool)
                    setView('poolform')
                  }}
                  onDelete={() => removePool(pool.id)}
                />
              </div>
            </Collapse>
          ))}
        </div>

        {poolDrafts.length >= POOLS_MAX ? (
          <WarningBanner message={`Maximal ${POOLS_MAX} Umfragen`} />
        ) : (
          <div className={cardClass}>
            <button
              type='button'
              onClick={() => {
                setEditingPool(null)
                setView('poolform')
              }}
              className={rowClass}
            >
              <span className='flex h-6 w-6 items-center justify-center rounded-full bg-success'>
                <Plus size={16} strokeWidth={3} className='text-white' />
              </span>
              <span className='text-button text-label-large'>Umfrage hinzufügen</span>
            </button>
          </div>
        )}
        </>
        )}
        </div>
      </SettingsPage>
    )
  }

  return (
    <>
      <SettingsPage title='Bearbeiten' fill backHref={`/parties/${partyId}`} onBack={handleBack}>
        {loading ? (
          // Shaped like what it replaces, the way the party list's card skeleton is:
          // the five 50px rows, the description box, the two-row card and the button,
          // so nothing shifts when the real thing arrives.
          <div className='flex flex-col gap-6'>
            <div className='flex flex-col gap-4'>
              <div className='mx-4 h-5 w-24 rounded-full skeleton' />
              <div className='h-62.5 w-full rounded-[25px] skeleton' />
              <div className='h-27.5 w-full rounded-[25px] skeleton' />
            </div>
            <div className='flex flex-col gap-4'>
              <div className='mx-4 h-5 w-24 rounded-full skeleton' />
              <div className='h-25 w-full rounded-[25px] skeleton' />
            </div>
            <div className='mt-auto h-12.5 w-full rounded-full skeleton' />
          </div>
        ) : (
          <div className='flex flex-col gap-6'>
            {/* The party page's own section heading, minus its chevron — same
                text-heading-4 at the same weight, so the two screens read as one app
                rather than a settings sheet bolted onto it. The px-4 is the row
                padding: it lines the heading up with Name, Datum and the rest below
                it rather than with the card's outer edge. */}
            <div className='flex flex-col gap-4'>
              {/* Only the headings animate. The cards below carry backdrop-blur-xl,
                  and an ancestor animating opacity or transform becomes their backdrop
                  root — they would sit flat and grey for the whole 300ms. */}
              <span className='px-4 text-heading-4 font-semibold text-heading animate-fade-in-up'>Details</span>
              <div className={cardClass}>
                <label className={rowClass}>
                  <span className={rowLabelClass}>Name</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onFocus={caretToEnd}
                    maxLength={TITLE_MAX}
                    placeholder='Partyname'
                    className={rowInputClass}
                  />
                </label>

                <RowDivider />

                <button type='button' onClick={() => setDateOpen(true)} className={rowClass}>
                  <span className={rowLabelClass}>Datum</span>
                  <span className={`ml-auto ${rowValueClass}`}>
                    {pad(date.day)}.{pad(date.month + 1)}.{date.year}
                  </span>
                  {chevron}
                </button>

                <RowDivider />

                {/* Named like the party page's stats: one time is the plain
                    'Uhrzeit', two are 'Startzeit' and 'Endzeit'. */}
                <button type='button' onClick={() => setTimeOpen(true)} className={rowClass}>
                  <span className={rowLabelClass}>{hasEndTime ? 'Startzeit' : 'Uhrzeit'}</span>
                  <span className={`ml-auto ${rowValueClass}`}>
                    {pad(time.hour)}:{pad(time.minute)} Uhr
                  </span>
                  {chevron}
                </button>

                {/* Unfolds out of the card the way the create flow's end row does,
                    so the switch below visibly makes room for it. */}
                <Collapse open={hasEndTime}>
                  <RowDivider />
                  <button type='button' onClick={() => setEndOpen(true)} className={rowClass}>
                    <span className={rowLabelClass}>Endzeit</span>
                    <span className={`ml-auto ${rowValueClass}`}>
                      {pad(endTime.hour)}:{pad(endTime.minute)} Uhr
                    </span>
                    {chevron}
                  </button>
                </Collapse>

                <RowDivider />

                <button type='button' onClick={() => setView('location')} className={rowClass}>
                  <span className={rowLabelClass}>Location</span>
                  <span className={`ml-auto truncate ${rowValueClass}`}>{fullLocation || 'Adresse'}</span>
                  {chevron}
                </button>

                <RowDivider />

                <button type='button' onClick={() => setView('background')} className={rowClass}>
                  <span className={rowLabelClass}>Hintergrund</span>
                  <span className={`ml-auto truncate ${rowValueClass}`}>{backgroundLabel}</span>
                  {chevron}
                </button>

                <RowDivider />

                <label className={rowClass}>
                  <span className={rowLabelClass}>Max. Gäste</span>
                  <input
                    inputMode='numeric'
                    value={maxGuests}
                    onFocus={caretToEnd}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '')
                      setMaxGuests(Number(digits) > GUESTS_MAX ? String(GUESTS_MAX) : digits)
                    }}
                    placeholder='unbegrenzt'
                    className={rowInputClass}
                  />
                </label>
              </div>

              {maxGuestsBelowGoing && (
                <WarningBanner
                  message={`${guestCount} ${guestCount === 1 ? 'Gast hat' : 'Gäste haben'} schon zugesagt — weniger geht nicht`}
                />
              )}

              <Switch label='Endzeitpunkt hinzufügen' checked={hasEndTime} onChange={setHasEndTime} />

              {/* A description is paragraphs, not a value: in a 50px row you see
                  about four words of it. Same box the create flow uses for the
                  same text — card with p-4 and a four-row textarea. */}
              <div className={`${cardClass} p-4`}>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder='Beschreibung'
                  rows={4}
                  maxLength={DESCRIPTION_MAX}
                  className='w-full resize-none bg-transparent text-button text-subheading outline-none'
                />
              </div>
              {description.length >= DESCRIPTION_MAX && (
                <WarningBanner message={`Maximal ${DESCRIPTION_MAX} Zeichen`} />
              )}
            </div>

            {/* Lists, not values — so they are their own screens rather than rows
                that open a sheet. */}
            <div className='flex flex-col gap-4'>
              <span className='px-4 text-heading-4 font-semibold text-heading animate-fade-in-up'>Inhalte</span>
              <div className={cardClass}>
                <button type='button' onClick={() => setView('pools')} className={rowClass}>
                  <span className={rowLabelClass}>Umfragen</span>
                  <span className={`ml-auto ${rowValueClass}`}>{poolDrafts.length}</span>
                  {chevron}
                </button>

                <RowDivider />

                <button type='button' onClick={() => router.push(`/parties/${partyId}/guests?from=edit`)} className={rowClass}>
                  <span className={rowLabelClass}>Gäste</span>
                  <span className={`ml-auto ${rowValueClass}`}>
                    {maxGuests ? `${guestCount} von ${maxGuests}` : guestCount}
                  </span>
                  {chevron}
                </button>
              </div>
            </div>

            {/* Saving is what this page is for, so it comes first; deleting sits
                underneath it, last on the page and out of the way of a stray tap. */}
            <button
              type='button'
              onClick={handleSave}
              disabled={!canSave || saving}
              className={`${primaryButtonClass} mt-auto`}
            >
              {saving ? <Spinner /> : 'speichern'}
            </button>

          </div>
        )}
      </SettingsPage>

      {dateOpen && <PartyDateSheet value={date} onChange={setDate} onClose={() => setDateOpen(false)} />}
      {timeOpen && <PartyTimeSheet value={time} onChange={setTime} onClose={() => setTimeOpen(false)} />}
      {endOpen && <PartyTimeSheet value={endTime} onChange={setEndTime} onClose={() => setEndOpen(false)} />}

      {askLeave && (
        <UnsavedChangesDialog
          saving={saving}
          onSave={handleSave}
          onDiscard={() => router.push(`/parties/${partyId}`)}
          onCancel={() => setAskLeave(false)}
        />
      )}
    </>
  )
}
