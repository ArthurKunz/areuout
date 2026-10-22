import { Capacitor } from '@capacitor/core'
import { supabase } from '@/lib/supabase/client'
import { getOrigin } from '@/lib/utils'
import { AUTH_CALLBACK_PATH, GOOGLE_IOS_CLIENT_ID } from '../constants/auth.constants'

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

// Apple and Google put the hashed nonce into their ID token; Supabase hashes the raw one
// and compares, so a stolen token cannot be replayed.
async function createNonce() {
  const rawNonce = toHex(crypto.getRandomValues(new Uint8Array(32)))
  const hashedNonce = toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawNonce))))
  return { rawNonce, hashedNonce }
}

// Only inside the iOS app, and only in a build that carries the plugin: the app loads
// the live site, so an older install would otherwise offer a sheet that cannot open.
export const isNativeLogin = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('SocialLogin')

// Native only (iOS app): Google blocks its OAuth page inside the app's WebView.
// With a nonce the plugin always shows Google's sheet instead of restoring an old
// sign-in, whose token would carry no matching nonce.
export async function signInWithGoogleNative() {
  const { rawNonce, hashedNonce } = await createNonce()

  const { SocialLogin } = await import('@capgo/capacitor-social-login')
  await SocialLogin.initialize({ google: { iOSClientId: GOOGLE_IOS_CLIENT_ID, mode: 'online' } })
  const { result } = await SocialLogin.login({
    provider: 'google',
    options: { scopes: ['email', 'profile'], nonce: hashedNonce },
  })
  const idToken = 'idToken' in result ? result.idToken : null
  if (!idToken) throw new Error('Google hat kein Token geschickt.')

  return supabase.auth.signInWithIdToken({ provider: 'google', token: idToken, nonce: rawNonce })
}

// Native only (iOS app). The plugin is imported here, on tap, so it never reaches SSR
// or the web bundle.
export async function signInWithApple() {
  const { rawNonce, hashedNonce } = await createNonce()

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

// Native only (iOS app), before an Apple user's account is deleted (App Store 5.1.1(v)).
// The user confirms with Apple once more; the fresh code goes to the Edge Function
// revoke-apple, which exchanges it and revokes the authorization at once. No Apple token
// is ever stored. Closing the sheet rejects with USER_CANCELLED, as on sign-in.
export async function revokeAppleAuthorization() {
  const { hashedNonce } = await createNonce()

  const { SocialLogin } = await import('@capgo/capacitor-social-login')
  // useProperTokenExchange only makes the plugin hand out the raw code; with no
  // redirectUrl it exchanges nothing itself. signInWithApple initializes again without it.
  await SocialLogin.initialize({ apple: { useProperTokenExchange: true } })
  const { result } = await SocialLogin.login({
    provider: 'apple',
    options: { scopes: [], nonce: hashedNonce },
  })
  const code = 'authorizationCode' in result ? result.authorizationCode : undefined
  if (!code) throw new Error('Apple hat keinen Code geschickt.')

  return supabase.functions.invoke('revoke-apple', { body: { code } })
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

