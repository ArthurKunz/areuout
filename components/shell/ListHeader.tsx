'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import IconButton from '@/components/shared/IconButton'

// Title row of a shell container. Part of the drag zone together with the handle;
// the plus button is excluded from it by Sheet.
export default function ListHeader({ title, plus = true }: { title: string; plus?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div data-sheet-drag className='flex h-11.25 shrink-0 touch-none items-center select-none justify-between px-5'>
      <h1 className='text-heading-1 font-bold text-heading'>{title}</h1>
      {/* Opens Create Party. The tab it was opened from travels along, so ✗ there can
          return to it. */}
      {plus && (
        <IconButton
          icon={Plus}
          label='Create party'
          onClick={() => router.push(`/create?from=${encodeURIComponent(pathname)}`)}
        />
      )}
    </div>
  )
}
