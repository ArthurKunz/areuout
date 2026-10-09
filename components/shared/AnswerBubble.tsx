'use client'

// One answer on the question's "Antworten" page: the author's name above
// their answer, in a rounded chat-bubble. The viewer's own answer sits
// right-aligned in the brand colour, everyone else's in bg-main: left-aligned by
// default (the host's question), right-aligned when `align` says so (the other
// answers on the Frage page). With onName, the name opens its author.
export default function AnswerBubble({
  name,
  text,
  variant,
  align = variant === 'own' ? 'right' : 'left',
  onName,
}: {
  name: string
  text: string
  variant: 'own' | 'other'
  align?: 'left' | 'right'
  onName?: () => void
}) {
  const own = variant === 'own'
  return (
    <div className={`flex ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[260px] rounded-[20px] px-4 py-2.5 glass-field ${
          own ? 'bg-brand' : 'bg-main'
        }`}
      >
        {onName ? (
          <button type='button' onClick={onName} className='block text-left text-text-3 text-text transition-opacity duration-(--duration-press) ease-ios active:opacity-60'>
            {name}
          </button>
        ) : (
          <span className={`block text-text-3 ${own ? 'text-main-white/70' : 'text-text'}`}>{name}</span>
        )}
        <span className={`block break-words text-text-2 font-semibold ${own ? 'text-main-white' : 'text-heading'}`}>{text}</span>
      </div>
    </div>
  )
}
