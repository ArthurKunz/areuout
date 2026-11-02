'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'

const INVITE = /^\/e\/[^/]+\/?$/
const FOLLOWED = 'areuout:followed-link'

let last: { url: string; at: number } | null = null

// A tapped invite link opens the app instead of Safari (App.entitlements and
// public/.well-known/apple-app-site-association decide that). iOS hands the URL to the
// App plugin, which keeps it until a listener exists, so a cold start lands here too.
// Only in a build that carries the plugin: the app loads the live site, so an older
// install gets this code and must do nothing.
//
// getLaunchUrl reports the same launch link as the retained appUrlOpen, so whichever
// arrives second is dropped. Its native value is never cleared either, so after a
// reload of the page it must not reopen a link that was already followed.
export default function UniversalLinks() {
  const router = useRouter()

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('App')) return

    const follow = (url: string) => {
      if (!url.startsWith(`${window.location.origin}/`)) return
      const path = new URL(url).pathname
      if (!INVITE.test(path)) return
      if (last?.url === url && Date.now() - last.at < 5000) return
      last = { url, at: Date.now() }
      try {
        sessionStorage.setItem(FOLLOWED, url)
      } catch {}
      router.push(path)
    }

    let followed: string | null = null
    try {
      followed = sessionStorage.getItem(FOLLOWED)
    } catch {}
    let handle: PluginListenerHandle | undefined
    let cancelled = false
    import('@capacitor/app')
      .then(async ({ App }) => {
        const added = await App.addListener('appUrlOpen', ({ url }) => follow(url))
        if (cancelled) return void added.remove()
        handle = added
        const launch = await App.getLaunchUrl()
        if (launch?.url && launch.url !== followed) follow(launch.url)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      void handle?.remove()
    }
  }, [router])

  return null
}
