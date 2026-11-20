import LegalTextScreen from '@/features/profile/LegalTextScreen'
import { IMPRESSUM } from '@/features/profile/legal/impressum'

// The words live in features/profile/legal/impressum.ts, so the iOS app loads exactly the
// same text through app/legal/[doc]/route.ts.
export default function ImpressumPage() {
  return <LegalTextScreen title={IMPRESSUM.title} sections={IMPRESSUM.sections} updated={IMPRESSUM.updated} />
}
