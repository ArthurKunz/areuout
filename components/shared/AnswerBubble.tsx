'use client'

// One answer on the question's "Antworten" page: the author's name above
// their answer, in a rounded chat-bubble. The viewer's own answer sits
// right-aligned in the brand colour, everyone else's left-aligned in
// bg-main — including the host's original question.
export default function AnswerBubble({
  name,
  text,
  variant,
}: {
  name: string
  text: string
  variant: 'own' | 'other'
}) {
  const own = variant === 'own'
  return (
    <div className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[260px] rounded-[20px] px-4 py-2.5 backdrop-blur-[100px] ${
          own ? 'bg-brand' : 'bg-main'
        }`}
      >
        <span className={`block text-text-3 ${own ? 'text-main-white/70' : 'text-text'}`}>{name}</span>
        <span className={`block text-text-2 font-bold ${own ? 'text-main-white' : 'text-heading'}`}>{text}</span>
      </div>
    </div>
  )
}
