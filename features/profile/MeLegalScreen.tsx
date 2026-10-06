'use client'

import { useRouter } from 'next/navigation'
import { FitSheet } from '@/components/shell/Shell'
import StepFrame from '@/features/create-party/StepFrame'
import SettingsList from '@/components/shared/SettingsList'

// Page `Rechtliches` (App Redesign 8). The texts live at the app root, not under /me:
// they have to render without a session, and proxy.ts only lets public paths through.
export default function MeLegalScreen() {
  const router = useRouter()

  return (
    <>
      <FitSheet />
      <StepFrame title='Rechtliches' onBack={() => router.push('/me')} button={null}>
        <SettingsList
          rows={[
            { label: 'Impressum', onClick: () => router.push('/impressum') },
            { label: 'Datenschutz', onClick: () => router.push('/datenschutz') },
            { label: 'Nutzungsbedingungen', onClick: () => router.push('/nutzungsbedingungen') },
          ]}
        />
      </StepFrame>
    </>
  )
}
