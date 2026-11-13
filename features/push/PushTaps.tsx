'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'

// Paths a tapped push may open. Only the agent's push to the admins carries one
// (private.queue_admin_push, data.path = '/admin'); the join-request pushes carry only an
// event_id and still just open the app.
const OPENS = new Set(['/admin'])

// The plugin keeps a tap until a listener exists (retainUntilConsumed), so a tap that
// started the app lands here too. Only in a build that carries the plugin: the app loads
// the live site, so an older install gets this code and must do nothing.
export default function PushTaps() {
  const router = useRouter()

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('PushNotifications')) return

    let handle: PluginListenerHandle | undefined
    let cancelled = false
    import('@capacitor/push-notifications')
      .then(async ({ PushNotifications }) => {
        const added = await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
          const path: unknown = notification.data?.path
          if (typeof path === 'string' && OPENS.has(path)) router.push(path)
        })
        if (cancelled) return void added.remove()
        handle = added
      })
      .catch(() => {})
    return () => {
      cancelled = true
      void handle?.remove()
    }
  }, [router])

  return null
}
