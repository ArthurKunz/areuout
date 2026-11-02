'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'

const INVITE = /^\/e\/[^/]+\/?$/

// A tapped invite link opens the app instead of Safari (App.entitlements and
// public/.well-known/apple-app-site-association decide that). iOS hands the URL to the
// App plugin, which keeps it until a listener exists, so a cold start lands here too.
// Only in a build that carries the plugin: the app loads the live site, so an older
// install gets this code and must do nothing.
export default function UniversalLinks() {
  const router = useRouter()

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('App')) return
    let handle: PluginListenerHandle | undefined
    let cancelled = false
    import('@capacitor/app')
      .then(({ App }) =>
        App.addListener('appUrlOpen', ({ url }) => {
          if (!url.startsWith(`${window.location.origin}/`)) return
          const path = new URL(url).pathname
          if (INVITE.test(path)) router.push(path)
        })
      )
      .then((added) => {
        if (cancelled) void added.remove()
        else handle = added
      })
      .catch(() => {})
    return () => {
      cancelled = true
      void handle?.remove()
    }
  }, [router])

  return null
}
