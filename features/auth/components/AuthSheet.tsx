'use client'

import Link from 'next/link'
import { useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import { CircleAlert } from 'lucide-react'
import { alertError } from '@/lib/utils'
import BigButton from '@/components/shared/BigButton'
import Spinner from '@/components/shared/Spinner'
import { Alert, AlertDescription, AlertTitle } from '@/components/shared/Alert'
import { authBannerMessage } from '../services/auth-errors'
import { signInWithApple, signInWithGoogle } from '../services/auth.service'

type Props = {
  onCreateAccount: () => void
  onSignIn: () => void
  // Where to return after the OAuth round-trip (an invite link, usually).
  next?: string | null
  description?: string
}

// The platform never changes while the page lives, so there is nothing to subscribe to.
const noSubscription = () => () => {}
const isAppleAvailable = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('SocialLogin')

// The start screen (App Redesign 9): the content of the shell container over the map,
// on /login and on the invite page for someone without an account.
export default function AuthSheet({ onCreateAccount, onSignIn, next, description }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [applePending, setApplePending] = useState(false)
  const [appleWarning, setAppleWarning] = useState<string | null>(null)
  // Only inside the iOS app, and only in a build that carries the plugin: the app loads
  // the live site, so an older install would otherwise get a button that cannot work.
  // The server snapshot is false, so the server and the first client render agree (no
  // button). The Apple button on the website is a later step (4.10).
  const appleAvailable = useSyncExternalStore(noSubscription, isAppleAvailable, () => false)

  const handleGoogle = async () => {
    setPending(true)
    const { error } = await signInWithGoogle(next)
    // On success the browser leaves for Google, so we only get here on failure.
    if (error) {
      setPending(false)
      alertError('Anmeldung fehlgeschlagen. Bitte versuche es erneut.', error.message)
    }
  }

  const handleApple = async () => {
    setApplePending(true)
    setAppleWarning(null)
    try {
      const { error } = await signInWithApple()
      if (!error) {
        // A first-time user has no profile yet; proxy.ts sends them on to onboarding.
        router.push(next ?? '/explore')
        return
      }
      const banner = authBannerMessage(error)
      if (banner) setAppleWarning(banner)
      else alertError('Anmeldung fehlgeschlagen. Bitte versuche es erneut.', error.message)
    } catch (error) {
      // Closing Apple's sheet is a choice, not a failure.
      if ((error as { code?: string }).code !== 'USER_CANCELLED') {
        alertError('Anmeldung fehlgeschlagen. Bitte versuche es erneut.', (error as Error).message)
      }
    }
    setApplePending(false)
  }

  return (
    <div className='flex flex-col items-center gap-3 overflow-y-auto px-5 pb-6'>
      {description && <p className='max-w-[350px] text-center text-text-2 text-text'>{description}</p>}

      <BigButton variant='main' onClick={onCreateAccount}>
        Sign up
      </BigButton>
      <BigButton variant='main' onClick={onSignIn}>
        Anmelden
      </BigButton>

      <div className='flex w-full max-w-[350px] items-center gap-2'>
        <span className='h-px flex-1 bg-divider' />
        <span className='text-text-4 text-text'>oder</span>
        <span className='h-px flex-1 bg-divider' />
      </div>

      {/* Apple's button rules (guideline 4.8): its own logo, its own wording, black on
          white, and no smaller than the other sign-in buttons. */}
      {appleAvailable && (
        <BigButton variant='white' onClick={handleApple} disabled={applePending}>
          {applePending ? (
            <Spinner />
          ) : (
            <span className='flex items-center gap-1.5'>
              {/* Apple's file is a black glyph on an opaque white square; on our 90% white
                  glass the square shows. The file stays untouched and serves as a mask:
                  a full layer minus its luminance (white = 1) leaves only the glyph, filled
                  black. Glyph in the 56-unit viewBox: x 20.5–35.5, y 16–35, so at 56px
                  it is 15 × 19 px. Where the mask is unsupported (iOS before 15.4) the
                  span stays hidden instead of turning into a black box. */}
              <span
                aria-hidden='true'
                className='hidden h-[19px] w-[15px] shrink-0 bg-heading-black supports-[(mask-mode:luminance)_and_(mask-composite:subtract)]:block'
                style={{
                  maskImage: 'linear-gradient(#000 0 0), url(/images/apple-logo.svg)',
                  maskMode: 'alpha, luminance',
                  maskComposite: 'subtract',
                  maskSize: '100% 100%, 56px 56px',
                  maskPosition: '0 0, -20.5px -16px',
                  maskRepeat: 'no-repeat',
                }}
              />
              Weiter mit Apple
            </span>
          )}
        </BigButton>
      )}

      {/* The wait here is a redirect to Google, which is exactly the kind of
          shapeless pause the spinner exists for. */}
      <BigButton variant='white' onClick={handleGoogle} disabled={pending}>
        {pending ? <Spinner /> : 'Google'}
      </BigButton>

      {appleWarning && (
        <div className='w-full max-w-[350px]'>
          <Alert>
            <CircleAlert />
            <AlertTitle>Anmelden hat nicht geklappt</AlertTitle>
            <AlertDescription>{appleWarning}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Google and Apple sign up without SignUpForm, so the consent sentence stands here
          too (Store Launch Checklist item 10): a new account goes straight on to
          onboarding and creates content from there. Same words and links as SignUpForm. */}
      <p className='max-w-[350px] px-1 text-center text-text-4 text-text'>
        {appleAvailable ? 'Mit „Google“ oder „Apple“' : 'Mit „Google“'} bestätigst du, dass du mindestens 16 Jahre alt bist, und stimmst den{' '}
        <Link href='/nutzungsbedingungen' target='_blank' rel='noopener noreferrer' className='underline text-heading'>
          Nutzungsbedingungen
        </Link>{' '}
        und der{' '}
        <Link href='/datenschutz' target='_blank' rel='noopener noreferrer' className='underline text-heading'>
          Datenschutzerklärung
        </Link>{' '}
        zu.
      </p>

      {/* Dieser Bildschirm ist der einzige Ort, den JEDER Fremde zu sehen bekommt: er liegt
          auf /login und auf der Einladungsseite. Damit ist es auch die Stelle, an der
          das Impressum ohne Konto erreichbar sein muss — ein Impressum muss ständig
          verfügbar und leicht erkennbar sein, nicht erst nach der Anmeldung.

          target='_blank', damit ein Blick hinein den angefangenen Login nicht wegwirft. */}
      <div className='flex items-center justify-center gap-1 pt-2 text-text-4 text-text'>
        <Link href='/impressum' target='_blank' rel='noopener noreferrer'>
          Impressum
        </Link>
        <span aria-hidden='true'>·</span>
        <Link href='/datenschutz' target='_blank' rel='noopener noreferrer'>
          Datenschutz
        </Link>
        <span aria-hidden='true'>·</span>
        <Link href='/nutzungsbedingungen' target='_blank' rel='noopener noreferrer'>
          Nutzungsbedingungen
        </Link>
      </div>
    </div>
  )
}
