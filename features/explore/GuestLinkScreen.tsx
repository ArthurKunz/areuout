'use client'

import StepFrame from '@/features/create-party/StepFrame'

// The guest link (/p/<party id>) is what everyone who is not the host shares from the iOS
// app (vault: Native Redesign 6). With the app installed, iOS opens it there through the
// Universal Link and this page never shows. Without the app it asks for the app: the web
// app is about to become a landing page, so there is deliberately no party shown here, and
// nothing about a private party reaches a visitor without access.
const APP_STORE_URL = 'https://apps.apple.com/de/app/id6830150673'

export default function GuestLinkScreen() {
  return (
    <div className='mx-auto flex min-h-dvh w-shell-width flex-col pt-6 pb-safe-rsvp'>
      <StepFrame
        title='Eine Party für dich'
        button={{ label: 'App laden', onClick: () => window.location.assign(APP_STORE_URL) }}
      >
        <p className='w-full text-center text-text-2 text-main-white'>
          Jemand hat dir eine Party auf areuout geschickt. Öffne den Link auf deinem iPhone mit der areuout-App.
        </p>
      </StepFrame>
    </div>
  )
}
