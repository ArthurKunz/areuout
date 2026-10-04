'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, Search, X } from 'lucide-react'
import { cardClass, RowDivider } from '@/components/shared/Card'
import Collapse from '@/components/shared/Collapse'
import {
  DEBOUNCE_MS,
  MIN_QUERY_LENGTH,
  searchAddresses,
  type AddressResult,
} from '@/features/parties/services/address.service'

// Matches Collapse's own duration: the list has to finish folding away before its
// contents are cleared, or the box would empty in one frame instead of animating.
const COLLAPSE_MS = 300

export default function AddressSearchField({
  value,
  onChange,
  onSelect,
}: {
  value: string
  onChange: (address: string) => void
  onSelect: (result: AddressResult) => void
}) {
  const [results, setResults] = useState<AddressResult[]>([])
  const [loading, setLoading] = useState(false)
  // True once a search has come back for what is currently typed. It is what tells
  // an empty list ('Keine Adresse gefunden') apart from never having searched, so
  // the box does not unfold onto that line when a picked address is refocused.
  const [searched, setSearched] = useState(false)
  // The list belongs to the act of typing: it is only up while the field has focus.
  const [open, setOpen] = useState(false)
  // Picking a suggestion writes it into `value`, which would immediately look like
  // a new search term and re-open the list underneath the answer.
  const skipNextSearch = useRef(false)
  // Leaving the field closes the list, but a tap on a suggestion blurs the input
  // before it fires its click — so the close waits a moment for that click.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => () => {
    clearTimeout(closeTimer.current)
    clearTimeout(clearTimer.current)
  }, [])

  // The list reads bottom-up, so it opens at its BOTTOM: the best match sits whole
  // and tappable right above the field, and it is the worst one that gets cut off
  // at the top edge for scrolling up to.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [results, open, loading])

  useEffect(() => {
    const term = value.trim()
    if (skipNextSearch.current) {
      skipNextSearch.current = false
      return
    }
    // Zu kurz: kein Timer, kein AbortController, keine Anfrage. Hier wird bewusst auch
    // kein State zurückgesetzt — die alten Treffer bleiben stehen, werden aber nicht
    // mehr angezeigt, weil `tooShort` unten im Render darüber entscheidet. Ableiten
    // statt synchronisieren, sonst wäre es genau das kaskadierende setState, vor dem
    // der Kommentar darunter warnt.
    if (term.length < MIN_QUERY_LENGTH) return

    // AbortController rather than a stale-response check: a slow early request must
    // not overwrite the results of a later one.
    const controller = new AbortController()

    // The request itself runs from the timer, never straight from the effect body: a
    // synchronous fetch here would fire on every keystroke instead of on a pause.
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        setResults(await searchAddresses(term, controller.signal))
        setSearched(true)
      } catch {
        // An aborted request is the normal case here, not a failure worth reporting.
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value])

  // Aus dem Eingabewert abgeleitet, nicht gespeichert: das Vorschlagsfeld klappt damit
  // in demselben Frame zu, in dem das dritte Zeichen gelöscht wird, statt erst nachdem
  // ein Timer abgelaufen ist.
  const tooShort = value.trim().length < MIN_QUERY_LENGTH

  const handlePick = (result: AddressResult) => {
    clearTimeout(closeTimer.current)
    skipNextSearch.current = true
    setOpen(false)
    setSearched(false)
    // The rows are emptied only once the box has folded away — clearing them now
    // would drop its height in a single frame instead of animating it.
    clearTimeout(clearTimer.current)
    clearTimer.current = setTimeout(() => setResults([]), COLLAPSE_MS)
    onSelect(result)
  }

  return (
    // One column with no gap of its own: the space above the field belongs to the
    // suggestions and has to fold away with them, and a gap on this parent would go
    // on rendering around the collapsed box.
    <div className='flex w-full flex-col'>
      {/* The list sits above the field, so it is read from the bottom up: the best
          match is the row closest to what was typed. It unfolds while typing and
          folds away again on blur rather than appearing and vanishing — by HEIGHT,
          since it is a `backdrop-blur-xl` card and opacity would flatten it. */}
      <Collapse open={open && !tooShort && (loading || results.length > 0 || searched)}>
        {/* The gap to the field lives in here, so it folds away too. */}
        <div className='pb-3'>
          {/* Skeleton rather than a spinner: a suggestion has a known shape (pin,
              street, address line), so the list can be drawn before its content
              arrives. Three rows, not the full six — an empty block taller than most
              answers would collapse noisily every time a shorter set lands. */}
          {loading ? (
            <div className={cardClass}>
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  {i > 0 && <RowDivider />}
                  <div className='flex w-full items-center gap-3 px-4 py-3'>
                    <span className='skeleton h-10 w-10 shrink-0 rounded-full' />
                    <span className='flex min-w-0 flex-1 flex-col gap-1.5'>
                      <span className='skeleton h-3.5 w-2/5 rounded-full' />
                      <span className='skeleton h-3 w-4/5 rounded-full' />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : results.length > 0 ? (
            <div ref={listRef} className={`${cardClass} max-h-[45dvh] overflow-y-auto scrollbar-none`}>
              {[...results].reverse().map((result, i) => (
                <div key={result.id}>
                  {i > 0 && <RowDivider />}
                  <button
                    type='button'
                    onClick={() => handlePick(result)}
                    className='flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 active:bg-white/10'
                  >
                    <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tertiary backdrop-blur-xl'>
                      <MapPin size={18} strokeWidth={2.5} className='text-label-large' />
                    </span>
                    <span className='flex min-w-0 flex-col gap-0.5'>
                      <span className='truncate text-button text-label-large'>{result.street}</span>
                      <span className='line-clamp-1 text-label-2 text-subheading'>{result.label}</span>
                    </span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <span className='block px-4 text-center text-label-1 text-subheading'>
              Keine Adresse gefunden
            </span>
          )}
        </div>
      </Collapse>

      {/* No label on this row: the magnifier and the placeholder say what it is. */}
      <label className={`${cardClass} flex h-12.5 items-center gap-3 px-4`}>
        <Search size={18} strokeWidth={2.5} className='shrink-0 text-subheading' />
        <input
          type='text'
          value={value}
          onChange={(e) => {
            setOpen(true)
            onChange(e.target.value)
          }}
          onFocus={() => {
            clearTimeout(closeTimer.current)
            setOpen(true)
          }}
          onBlur={() => {
            closeTimer.current = setTimeout(() => setOpen(false), 150)
          }}
          placeholder='Adresse'
          enterKeyHint='search'
          className='min-w-0 flex-1 bg-transparent text-button text-subheading outline-none'
        />
        {value && (
          <button
            type='button'
            onClick={() => onChange('')}
            aria-label='Eingabe löschen'
            className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-tertiary backdrop-blur-xl'
          >
            <X size={13} strokeWidth={3} className='text-label-large' />
          </button>
        )}
      </label>
    </div>
  )
}
