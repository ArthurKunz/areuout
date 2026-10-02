'use client'

import type { ComponentProps } from 'react'
import { InputRow } from './Input'

// Two or more Input rows stacked in one 350px-wide, 25px-radius container,
// separated by hairline dividers (e.g. Startzeit/Endzeit).
export default function InputGroup({ rows }: { rows: ComponentProps<typeof InputRow>[] }) {
  return (
    <div className='w-[350px] rounded-[25px] bg-main backdrop-blur-[100px]'>
      {rows.map((row, i) => (
        <div key={row.label}>
          {i > 0 && <div className='mx-4 h-px rounded-full bg-divider' />}
          <InputRow {...row} />
        </div>
      ))}
    </div>
  )
}
