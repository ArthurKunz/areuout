'use client'

import { useEffect, useRef, useState } from 'react'
import StepFrame from '../StepFrame'
import SearchInput from '@/components/shared/SearchInput'
import LocationResultsList from '@/components/shared/LocationResultsList'
import { TallSheet } from '@/components/shell/Shell'
import {
  DEBOUNCE_MS,
  MIN_QUERY_LENGTH,
  searchAddresses,
  type AddressResult,
} from '@/features/parties/services/address.service'
import type { PartyDraft } from '../draft'

type Location = NonNullable<PartyDraft['location']>

// Step 3: an address search with no button of its own (mockup Create 04). A tap on a
// hit is the answer and leads on. Same search rules as AddressSearchField.
export default function LocationStep({
  draft,
  onPick,
  onBack,
  onClose,
}: {
  draft: PartyDraft
  onPick: (location: Location) => void
  onBack: () => void
  onClose: () => void
}) {
  const [query, setQuery] = useState(draft.location?.label ?? '')
  // null until a search has come back, so 'Keine Adresse gefunden' only shows for a
  // search that really found nothing.
  const [results, setResults] = useState<AddressResult[] | null>(null)
  // Coming back to this step prefills the picked address, which would otherwise look
  // like a new search term and fire straight away.
  const skipNextSearch = useRef(draft.location !== null)

  useEffect(() => {
    const term = query.trim()
    if (skipNextSearch.current) {
      skipNextSearch.current = false
      return
    }
    // Too short is derived in the render below rather than reset here.
    if (term.length < MIN_QUERY_LENGTH) return

    // AbortController rather than a stale-response check: a slow early request must
    // not overwrite the results of a later one.
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        setResults(await searchAddresses(term, controller.signal))
      } catch {
        // An aborted request is the normal case here, not a failure worth reporting.
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const tooShort = query.trim().length < MIN_QUERY_LENGTH

  return (
    <StepFrame title='Location' onClose={onClose} onBack={onBack} button={null}>
      {query && <TallSheet />}
      <SearchInput value={query} onChange={setQuery} placeholder='Location' />

      {!tooShort && results !== null &&
        (results.length > 0 ? (
          <LocationResultsList
            results={results.map((result) => ({
              id: result.id,
              // The row shows the short form as in the mockup, plus the city: the same
              // street and number exist in several towns around Leipzig. The full label
              // is what the party stores.
              label: [...new Set([result.street, result.city].filter(Boolean))].join(', ') || result.label,
              onClick: () => onPick({ label: result.label, lat: result.lat, lng: result.lng }),
            }))}
          />
        ) : (
          <span className='text-text-2 text-text'>Keine Adresse gefunden</span>
        ))}
    </StepFrame>
  )
}
