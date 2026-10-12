import Collapse from '@/components/shared/Collapse'

// shadcn's Alert, ported by hand and set in our look: the icon comes in as the first
// child, the title and the description sit in the column beside it.
//
//   <Alert>
//     <CircleAlert />
//     <AlertTitle>Anmelden hat nicht geklappt</AlertTitle>
//     <AlertDescription>{message}</AlertDescription>
//   </Alert>
//
// Two tones. 'error' (the default) is red: something failed or blocks the next step.
// 'notice' is neutral, for a state worth knowing that is nobody's mistake (a party that
// is over, a field at its limit), and goes without a title.
//
// Classes are joined by template string, not through tailwind-merge: it reads our own
// border-border (the 0.75px hairline from globals.css) as a border colour and drops it
// in favour of the tone's border-red/60.
//
// It unfolds when it appears instead of shoving everything below it in one frame (step
// 11d). By height, through Collapse: the surface is blurred, and a fade would leave it
// flat while it played.
const TONE = {
  error: 'border-red/60 bg-red/15 [&>svg]:text-red',
  notice: 'border-divider bg-selector [&>svg]:text-main-white',
} as const

export function Alert({
  tone = 'error',
  className = '',
  ...props
}: React.ComponentProps<'div'> & { tone?: keyof typeof TONE }) {
  return (
    <Collapse open appear className='w-full'>
      <div
        role='alert'
        className={`grid w-full grid-cols-[auto_1fr] items-start gap-x-2 gap-y-0.5 rounded-[25px] border-border px-4 py-3 backdrop-blur-xl [&>svg]:row-span-2 [&>svg]:size-4 [&>svg]:translate-y-0.5 ${TONE[tone]} ${className}`}
        {...props}
      />
    </Collapse>
  )
}

export function AlertTitle({ className = '', ...props }: React.ComponentProps<'div'>) {
  return <div className={`col-start-2 truncate text-text-3 font-semibold text-red ${className}`} {...props} />
}

export function AlertDescription({ className = '', ...props }: React.ComponentProps<'div'>) {
  return <div className={`col-start-2 text-text-3 text-main-white ${className}`} {...props} />
}
