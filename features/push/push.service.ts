import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { supabase } from '@/lib/supabase/client'

// Only inside the iOS app, and only in a build that carries the plugin: the app loads
// the live site, so an older install gets this code too and must do nothing.
const isNativePush = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('PushNotifications')

// Asks iOS for this device's token and waits for it. Nothing is stored: iOS hands out
// the same token on every register(), which is how sign-out finds it again after a
// restart. The plugin sends it as uppercase hex; push_tokens keeps it lowercase.
async function deviceToken(timeoutMs: number): Promise<string | null> {
  const { PushNotifications } = await import('@capacitor/push-notifications')
  return new Promise((resolve) => {
    let handles: PluginListenerHandle[] = []
    const done = (token: string | null) => {
      clearTimeout(timer)
      handles.forEach((handle) => void handle.remove())
      resolve(token)
    }
    const timer = setTimeout(() => done(null), timeoutMs)
    // The listeners go on before register(), or the answer can arrive unheard.
    Promise.all([
      PushNotifications.addListener('registration', (token) => done(token.value.toLowerCase())),
      PushNotifications.addListener('registrationError', () => done(null)),
    ])
      .then((added) => {
        handles = added
        return PushNotifications.register()
      })
      .catch(() => done(null))
  })
}

// iOS shows its dialog once. After a no, checkPermissions says denied for good, so
// nobody is asked twice and nothing has to remember the answer. Every failure is
// swallowed and nothing is logged: the token never reaches a log or an alert.
async function registerDevice(ask: boolean) {
  if (!isNativePush()) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { PushNotifications } = await import('@capacitor/push-notifications')
    let { receive } = await PushNotifications.checkPermissions()
    if (receive === 'prompt' && ask) ({ receive } = await PushNotifications.requestPermissions())
    if (receive !== 'granted') return
    const token = await deviceToken(10000)
    if (token) await supabase.rpc('register_push_token', { p_token: token })
  } catch {}
}

// After a join request, an RSVP of going or maybe, or a new party. Fire and forget, so
// it never holds up the action that called it.
export const askForPush = () => void registerDevice(true)

// On app start and after sign-in, only where permission is already granted: keeps
// updated_at fresh and moves the token to whoever is signed in now. Never a dialog.
export const refreshPush = () => void registerDevice(false)

// Before sign-out, while the session still lets RLS delete the row. Only this device's
// token; the others stay. At most 3 seconds, and a failure signs out all the same.
export async function forgetThisDevice() {
  if (!isNativePush()) return
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    if ((await PushNotifications.checkPermissions()).receive !== 'granted') return
    const token = await deviceToken(3000)
    if (token) await supabase.from('push_tokens').delete().eq('token', token)
  } catch {}
}
