import { supabase } from '@/lib/supabase/client'
import { getOrigin } from '@/lib/utils'
import { AUTH_CALLBACK_PATH } from '../constants/auth.constants'

export async function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

// Comes back through /callback so the ?next= of an invite link survives the
// round-trip and a brand-new OAuth user (who has no profiles row yet) can be
// sent to onboarding.
export async function signInWithGoogle(next?: string | null) {
  const origin = getOrigin()
  const query = next ? `?next=${encodeURIComponent(next)}` : ''
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}${AUTH_CALLBACK_PATH}${query}` },
  })
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// Native only (iOS app). Apple puts the SHA-256 of the nonce into its identity token;
// Supabase hashes the raw one and compares, so a stolen token cannot be replayed.
// The plugin is imported here, on tap, so it never reaches SSR or the web bundle.
export async function signInWithApple() {
  const rawNonce = toHex(crypto.getRandomValues(new Uint8Array(32)))
  const hashedNonce = toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawNonce))))

  const { SocialLogin } = await import('@capgo/capacitor-social-login')
  await SocialLogin.initialize({ apple: {} })
  const { result } = await SocialLogin.login({
    provider: 'apple',
    options: { scopes: ['email', 'name'], nonce: hashedNonce },
  })
  if (!result.idToken) throw new Error('Apple hat kein Token geschickt.')

  const response = await supabase.auth.signInWithIdToken({ provider: 'apple', token: result.idToken, nonce: rawNonce })

  // Apple sends the name on the first sign-in only. It goes into the auth metadata,
  // where onboarding offers it as a prefill; profiles is still written by onboarding
  // alone. The plugin replays a cached name on later sign-ins, hence the check.
  const user = response.data.user
  const givenName = result.profile.givenName?.trim() ?? ''
  const familyName = result.profile.familyName?.trim() ?? ''
  if (user && !user.user_metadata.given_name && (givenName || familyName)) {
    await supabase.auth.updateUser({ data: { given_name: givenName, family_name: familyName } })
  }

  return response
}

export async function signUpWithEmail(email: string, password: string) {
  return supabase.auth.signUp({ email, password })
}

// The verification sheet's own way to a fresh code. Without it the only route to one
// led backwards through the sign-up form, which then answered a repeat of the user's
// OWN address with 'diese Email hat schon ein Konto'.
export async function resendSignupOtp(email: string) {
  return supabase.auth.resend({ type: 'signup', email })
}

export async function verifySignupOtp(email: string, token: string) {
  return supabase.auth.verifyOtp({
    email,
    token,
    type: 'signup',
  })
}

export async function sendResetPasswordEmail(email: string) {
  const origin = getOrigin()
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: origin ? `${origin}${AUTH_CALLBACK_PATH}` : undefined,
  })
}

