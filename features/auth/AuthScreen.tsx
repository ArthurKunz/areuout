'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { sanitizeNextPath } from '@/lib/utils'
import { FitSheet } from '@/components/shell/Shell'
import AuthSheet from './components/AuthSheet'
import SignInForm from './components/SignInForm'
import SignUpForm from './components/SignUpForm'
import VerifyOtpForm from './components/VerifyOtpForm'
import ChangePasswordForm from '@/features/settings/components/ChangePasswordForm'

// `step` and `next` arrive as props rather than through useSearchParams, and that is
// the whole point: useSearchParams cannot be answered while a page is being
// prerendered, so React suspends and the boundary in page.tsx rendered its fallback —
// which was nothing. The server therefore shipped an empty body and the browser showed
// blank until the JavaScript had loaded, on the app's own front door.
//
// The page reads the query on the server instead and hands both values down. Nothing
// here needs them any earlier than that, so the screen renders on the server like
// every other one.
export default function AuthPage({
  stepParam,
  nextParam,
}: {
  stepParam: string | null
  nextParam: string | null
}) {
  const router = useRouter()
  // Sanitised here rather than in the page: this component should not have to trust
  // where its props came from.
  // Set when the flow was entered from somewhere specific (an invite link), so
  // every exit below returns there instead of dumping the user on the parties list.
  const next = sanitizeNextPath(nextParam)
  const onboardingHref = next ? `/onboarding?next=${encodeURIComponent(next)}` : '/onboarding'

  // Arriving with no ?step= means the user just landed on the site: the overview
  // sheet asks first whether they are signing up or signing in.
  const [step, setStep] = useState<'overview' | 'signup' | 'signin' | 'verify'>(
    stepParam === 'signup' ? 'signup' : stepParam === 'signin' ? 'signin' : 'overview'
  )
  const [signupEmail, setSignupEmail] = useState('')

  useEffect(() => {
    if (stepParam === 'onboarding') {
      router.push(onboardingHref)
    }
  }, [router, stepParam, onboardingHref])

  // The reset link from the email carries its step in the URL, so it wins over
  // whatever the local state says.
  const effectiveStep = stepParam === 'reset-password' ? ('reset-password' as const) : step

  return (
    <>
      {/* Over the shell's map, without navigation (App Redesign 9): the container is
          as tall as the step. */}
      <FitSheet />

      {effectiveStep === 'overview' && (
        <AuthSheet
          next={next}
          onCreateAccount={() => setStep('signup')}
          onSignIn={() => setStep('signin')}
        />
      )}

      {effectiveStep === 'signup' && (
        <SignUpForm
          initialEmail={signupEmail}
          onClose={() => setStep('overview')}
          onSignIn={() => setStep('signin')}
          onSuccess={(email, alreadySignedIn) => {
            // Auto-confirmed: the account is live and there is no code to enter.
            if (alreadySignedIn) {
              router.push(onboardingHref)
              return
            }
            setSignupEmail(email)
            setStep('verify')
          }}
        />
      )}

      {effectiveStep === 'verify' && (
        <VerifyOtpForm
          email={signupEmail}
          onSuccess={() => router.push(onboardingHref)}
        />
      )}

      {effectiveStep === 'signin' && (
        <SignInForm onClose={() => setStep('overview')} onSuccess={() => router.push(next ?? '/explore')} />
      )}

      {/* Where the reset link from the email lands. */}
      {effectiveStep === 'reset-password' && (
        <ChangePasswordForm onSuccess={() => router.push('/explore')} />
      )}
    </>
  )
}
