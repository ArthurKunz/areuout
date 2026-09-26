'use client'

import { useState } from 'react'
import { Check, Share } from 'lucide-react'
import { cardClass, rowClass, rowLabelClass, rowValueClass } from '@/components/shared/Card'
import { shareInvite } from '@/lib/utils'

// Zwei Stellen zeigen denselben Link zum Mitnehmen: der letzte Schritt von Create Party
// und das Overlay nach einem Link-Reset. Beide brauchen die Maskierung und den Teilen-
// Button haargenau gleich, sonst driften sie auseinander.
export default function InviteLinkCard({ title, link }: { title: string; link: string }) {
  const [shared, setShared] = useState(false)

  const handleShare = async () => {
    if (!link) return
    if (!(await shareInvite(title, link))) return
    setShared(true)
    setTimeout(() => setShared(false), 2000)
  }

  return (
    <div className={cardClass}>
      <div className={rowClass}>
        <span className={rowLabelClass}>Einladungslink</span>

        {/* The link is longer than the row, so it FADES OUT under the share button
            instead of being cut off. A gradient overlay would not do it here — the
            card is translucent, so painting `bg-secondary` over the text only dims
            it; masking makes the text itself transparent, on any background. */}
        <div className='ml-auto min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,#000_65%,transparent)] [-webkit-mask-image:linear-gradient(to_right,#000_65%,transparent)]'>
          <span className={`block whitespace-nowrap ${rowValueClass}`}>{link}</span>
        </div>

        <button
          type='button'
          onClick={handleShare}
          aria-label='Teilen'
          className='flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full bg-sheet text-sheet-heading transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-90'
        >
          {shared ? <Check size={16} strokeWidth={3} /> : <Share size={15} strokeWidth={2.5} />}
        </button>
      </div>
    </div>
  )
}
