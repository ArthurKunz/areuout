'use client'

import { ChevronRight, MessageCircleQuestionMark, Send } from 'lucide-react'

// The 350x188 question tile on the event detail page: yellow question-bubble
// badge top left, the question text, an answer row with a submit button,
// then a divider and an "Antworten anzeigen" row in the brand colour. Same
// bg-main + 100px blur as the other info cards.
export default function QuestionCard({
  question,
  value,
  onChange,
  placeholder,
  onSubmit,
  onShowAnswersClick,
}: {
  question: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  onSubmit?: () => void
  onShowAnswersClick?: () => void
}) {
  return (
    <div className='flex h-[188px] w-[350px] flex-col rounded-[25px] bg-main p-4 backdrop-blur-[100px]'>
      <span className='flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-yellow'>
        <MessageCircleQuestionMark size={18} className='text-main-white' />
      </span>
      <span className='mt-2 text-text-2 font-bold text-heading'>{question}</span>

      <div className='mt-auto flex flex-col gap-3'>
        <div className='h-px w-full bg-divider' />
        <div className='flex items-center gap-3'>
          <span className='shrink-0 text-text-3 font-semibold text-heading'>Antwort</span>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className='min-w-0 flex-1 bg-transparent text-right text-text-3 text-text outline-none placeholder:text-input'
          />
          <button
            type='button'
            onClick={onSubmit}
            aria-label='Antwort abschicken'
            className='flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full bg-brand'
          >
            <Send size={12} className='text-main-white' />
          </button>
        </div>
        <div className='h-px w-full bg-divider' />
        <button
          type='button'
          onClick={onShowAnswersClick}
          className='flex items-center justify-between text-text-2 font-medium text-brand'
        >
          <span>Antworten anzeigen</span>
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  )
}
