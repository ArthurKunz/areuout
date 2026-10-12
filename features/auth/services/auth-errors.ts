import type { AuthError } from '@supabase/supabase-js'

// Which failures get the inline red Alert (components/shared/Alert) and which get the
// blocking alertError.
//
// The test is NOT whose fault it is — it is whether the user can do something about it
// on the screen they are standing on. A wrong password, an expired code or a rate limit
// are all fixable right there, so they belong next to the field. Anything the user
// cannot act on (a degraded service, a misconfigured provider, a failed write) stays an
// alert, where it is unmissable and carries the raw detail worth screenshotting.
//
// Every message is the Alert's description under its title and should fit ONE line in
// the narrowest place it renders, the auth sheet.
const BANNER_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email oder Passwort stimmt nicht',
  email_not_confirmed: 'Bestätige zuerst deine Email',
  user_already_exists: 'Diese Email hat schon ein Konto',
  email_exists: 'Diese Email hat schon ein Konto',
  otp_expired: 'Der Code stimmt nicht',
  weak_password: 'Das Passwort ist zu schwach',
  same_password: 'Wähle ein neues Passwort',
  over_request_rate_limit: 'Zu viele Versuche. Warte kurz.',
  over_email_send_rate_limit: 'Zu viele Mails. Warte kurz.',
  validation_failed: 'Bitte prüfe deine Eingaben',
}

// Null means: this one is ours, not theirs — the caller should alert instead.
export function authBannerMessage(error: AuthError | null): string | null {
  if (!error?.code) return null
  return BANNER_MESSAGES[error.code] ?? null
}
