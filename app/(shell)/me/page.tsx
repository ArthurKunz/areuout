import { FitSheet } from '@/components/shell/Shell'
import MeScreen from '@/features/profile/MeScreen'

// The container is as tall as the profile needs, up to the same maximum as Create Party.
export default function ProfilePage() {
  return (
    <>
      <FitSheet />
      <MeScreen />
    </>
  )
}
