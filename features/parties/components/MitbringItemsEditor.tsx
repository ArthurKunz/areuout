'use client'

import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { cardClass, RowDivider, rowClass, rowInputClass, rowLabelClass } from '@/components/shared/Card'
import Collapse from '@/components/shared/Collapse'
import WarningBanner from '@/components/shared/WarningBanner'

// Ein Gegenstand ist eine Zeile auf der Partyseite, neben Avatar und Knopf: etwa 40
// Zeichen, bevor sie abgeschnitten wird.
const ITEM_MAX = 40
// Wie Collapse: eine Zeile klappt zu, bevor sie wirklich verschwindet.
const COLLAPSE_MS = 300

// Die Zeilen tragen eine eigene Id statt nach Position gekeyt zu sein. React wuerde
// sonst das DOM der entfernten Zeile fuer die wiederverwenden, die an ihre Stelle
// rueckt — die nachrueckende erbte dann die Animation der Zeile, die gegangen ist.
type Row = { id: number; value: string }
let nextRowId = 0
const toRows = (values: string[]): Row[] => values.map((value) => ({ id: nextRowId++, value }))

// Die Gegenstaende als eine Karte mit Zeilen, statt als ein Formular je Gegenstand:
// ein Gegenstand ist ein kurzer Text ohne Beschreibung, ein ganzer Bildschirm dafuer
// waere zu viel. Zwei Aufrufer, der Erstellen-Flow und die Bearbeiten-Unterseite.
//
// Die Komponente fuehrt ihre Zeilen selbst und meldet nur den fertigen Stand nach
// oben. Sie wird beim Verlassen der Ansicht abgeraeumt und beim naechsten Oeffnen aus
// `items` neu aufgebaut — deshalb reicht der Anfangswert.
export default function MitbringItemsEditor({
  items,
  onChange,
  max,
}: {
  items: string[]
  onChange: (next: string[]) => void
  max: number
}) {
  const [rows, setRows] = useState(() => toRows(items.length > 0 ? items : ['']))
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [addedId, setAddedId] = useState<number | null>(null)
  const removeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Der Timeout unten feuert 300ms spaeter und saehe in seiner Closure sonst die
  // Zeilen von damals — wer waehrenddessen weitertippt, haette seine Eingabe
  // verloren. Beschrieben wird der Ref nur in den Handlern, nie beim Rendern.
  const rowsRef = useRef(rows)

  useEffect(() => () => clearTimeout(removeTimer.current), [])

  // Leere Zeilen zaehlen nicht: die eine Zeile, mit der die Karte oeffnet, ist ein
  // Angebot und kein Gegenstand.
  const publish = (next: Row[]) => onChange(next.map((r) => r.value.trim()).filter(Boolean))

  const apply = (next: Row[]) => {
    rowsRef.current = next
    setRows(next)
    publish(next)
  }

  const setRow = (id: number, value: string) =>
    apply(rows.map((r) => (r.id === id ? { ...r, value } : r)))

  const addRow = () => {
    const [row] = toRows([''])
    // Kein publish: eine frische Zeile ist leer und zaehlt noch nicht.
    const next = [...rowsRef.current, row]
    rowsRef.current = next
    setRows(next)
    setAddedId(row.id)
  }

  // Erst zusammenfalten, dann wegnehmen — sonst verschwindet die Hoehe in einem Bild.
  // apply statt eines Updaters mit publish darin: ein Updater darf zweimal laufen,
  // und onChange ist eine Wirkung nach aussen, die genau einmal gehoert.
  const removeRow = (id: number) => {
    if (removingId !== null) return
    setRemovingId(id)
    removeTimer.current = setTimeout(() => {
      apply(rowsRef.current.filter((r) => r.id !== id))
      setRemovingId(null)
    }, COLLAPSE_MS)
  }

  const filled = rows.filter((r) => r.value.trim().length > 0).length

  return (
    <div className='flex w-full flex-col gap-3'>
      <div className={cardClass}>
        {rows.map((row, i) => (
          <Collapse key={row.id} open={row.id !== removingId} appear={row.id === addedId}>
            {i > 0 && <RowDivider />}
            <div className={rowClass}>
              {/* Die letzte verbliebene Zeile bleibt stehen — sonst hat die Karte
                  nichts mehr, in das man tippen koennte. */}
              {rows.length > 1 && (
                <button
                  type='button'
                  onClick={() => removeRow(row.id)}
                  aria-label={`Gegenstand ${i + 1} entfernen`}
                  className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning'
                >
                  <Minus size={16} strokeWidth={3} className='text-white' />
                </button>
              )}
              <span className={rowLabelClass}>Gegenstand {i + 1}</span>
              <input
                type='text'
                value={row.value}
                onChange={(e) => setRow(row.id, e.target.value)}
                placeholder={i === 0 ? 'z.B. Chips' : 'z.B. Eis'}
                maxLength={ITEM_MAX}
                className={rowInputClass}
              />
            </div>
          </Collapse>
        ))}

        {/* An der Grenze geht die Zeile und der Grund tritt an ihre Stelle. */}
        {rows.length < max && (
          <>
            <RowDivider />
            <button type='button' onClick={addRow} className={rowClass}>
              <span className='flex h-6 w-6 items-center justify-center rounded-full bg-success'>
                <Plus size={16} strokeWidth={3} className='text-white' />
              </span>
              <span className='text-button text-label-large'>Gegenstand hinzufügen</span>
            </button>
          </>
        )}
      </div>

      {rows.some((r) => r.value.length >= ITEM_MAX) && (
        <WarningBanner message={`Maximal ${ITEM_MAX} Zeichen pro Gegenstand`} />
      )}

      {filled >= max && <WarningBanner message={`Maximal ${max} Gegenstände`} />}
    </div>
  )
}
