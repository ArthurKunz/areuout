'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cardClass, rowClass, rowLabelClass, rowValueClass } from '@/components/shared/Card'

// Zwei Stellen zeigen denselben Link zum Mitnehmen: der letzte Schritt von Create Party
// und das Overlay nach einem Link-Reset. Beide brauchen die Maskierung und den Copy-
// Button haargenau gleich, sonst driften sie auseinander.
export default function InviteLinkCard({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      // navigator.clipboard ist ein Secure-Context-Feature und fehlt auf der LAN-
      // Testadresse — derselbe Grund, der in lib/utils.ts gegen crypto.randomUUID steht.
      const el = document.createElement('textarea')
      el.value = link
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

  return (
    <div className={cardClass}>
      <div className={rowClass}>
        <span className={rowLabelClass}>Einladungslink</span>

        {/* The link is longer than the row, so it FADES OUT under the copy button
            instead of being cut off. A gradient overlay would not do it here — the
            card is translucent, so painting `bg-secondary` over the text only dims
            it; masking makes the text itself transparent, on any background. */}
        <div className='ml-auto min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,#000_65%,transparent)] [-webkit-mask-image:linear-gradient(to_right,#000_65%,transparent)]'>
          <span className={`block whitespace-nowrap ${rowValueClass}`}>{link}</span>
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
  )
}
