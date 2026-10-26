'use client'

import { useEffect } from 'react'
import { refreshPush } from './push.service'

// In the shell layout, which mounts when the app opens on a signed-in screen and again
// after every sign-in (login lives outside it). Never asks, see refreshPush.
export default function PushRefresh() {
  useEffect(() => {
    refreshPush()
  }, [])
  return null
}
