'use client'

import { ChevronRight } from 'lucide-react'

type SettingsRow =
  | {
      label: string
      value: string
      onChange: (next: string) => void
      placeholder?: string
      // Called when the field loses focus or Enter is pressed, for rows that save in place.
      onCommit?: () => void
      maxLength?: number
      onClick?: never
    }
  | {
      label: string
      onClick: () => void
      value?: never
      onChange?: never
      placeholder?: never
      onCommit?: never
      maxLength?: never
    }

// The 350x210 profile/settings list: one 50px row per item, either an
// editable label/input pair (Name) or a label with a chevron that
// navigates further (Password, Account verwalten, Rechtliches). Divided
// the same way as InputGroup.
export default function SettingsList({ rows }: { rows: SettingsRow[] }) {
  return (
    <div className='flex w-[350px] flex-col justify-center rounded-[25px] bg-main py-[5px] glass-control'>
      {rows.map((row, i) => (
        <div key={row.label}>
          {i > 0 && <div className='mx-4 h-px rounded-full bg-divider' />}
          {row.onChange ? (
            <div className='flex h-[50px] w-full items-center justify-between gap-3 px-4'>
              <span className='shrink-0 text-text-2 font-semibold text-heading'>{row.label}</span>
              <input
                value={row.value}
                onChange={(e) => row.onChange(e.target.value)}
                placeholder={row.placeholder}
                maxLength={row.maxLength}
                onBlur={row.onCommit}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                enterKeyHint='done'
                className='min-w-0 flex-1 bg-transparent text-right text-text-2 text-text outline-none placeholder:text-input'
              />
            </div>
          ) : (
            <button
              type='button'
              onClick={row.onClick}
              className='flex h-[50px] w-full items-center justify-between px-4 text-left'
            >
              <span className='text-text-2 font-semibold text-heading'>{row.label}</span>
              <ChevronRight size={20} className='text-text' />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
