import LegalTextScreen from '@/features/profile/LegalTextScreen'
import { NUTZUNGSBEDINGUNGEN } from '@/features/profile/legal/nutzungsbedingungen'

// The words live in features/profile/legal/nutzungsbedingungen.ts, so the iOS app loads exactly the
// same text through app/legal/[doc]/route.ts.
export default function NutzungsbedingungenPage() {
  return <LegalTextScreen title={NUTZUNGSBEDINGUNGEN.title} sections={NUTZUNGSBEDINGUNGEN.sections} updated={NUTZUNGSBEDINGUNGEN.updated} />
}
