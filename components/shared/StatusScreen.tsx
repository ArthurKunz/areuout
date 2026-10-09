import FloatingEmojis from '@/features/parties/components/FloatingEmojis'

// The full-page shell behind not-found and error: the parties list's empty state,
// blown up to a whole screen. Shared because the two pages differ only in their
// emoji, their words and their buttons.
export const statusButtonClass =
  'flex h-12.5 items-center gap-2 rounded-full bg-sheet px-6 text-button font-semibold text-sheet-heading transition-transform duration-(--duration-press) ease-ios active:scale-95'

export default function StatusScreen({
  emoji,
  title,
  text,
  children,
}: {
  emoji: string
  title: string
  text: string
  children: React.ReactNode
}) {
  return (
    <div className='relative flex h-dvh w-full flex-col items-center justify-center gap-8 overflow-hidden bg-main'>
      <FloatingEmojis active seed />

      {/* z-10 like every other screen's content wrapper: FloatingEmojis lays a
          backdrop-blur veil at z-[1], and anything below that comes out blurred. */}
      <div className='relative z-10 flex flex-col items-center gap-8'>
        <span className='text-6xl'>{emoji}</span>

        <div className='flex w-75 flex-col items-center gap-1 px-4 text-center'>
          <span className='font-semibold text-heading-4 text-heading'>{title}</span>
          <span className='text-label-2 text-subheading'>{text}</span>
        </div>

        <div className='flex flex-col items-center gap-4'>{children}</div>
      </div>
    </div>
  )
}
