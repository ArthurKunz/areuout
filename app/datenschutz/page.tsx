import LegalTextScreen from '@/features/profile/LegalTextScreen'
import { DATENSCHUTZ } from '@/features/profile/legal/datenschutz'

// The words live in features/profile/legal/datenschutz.ts, so the iOS app loads exactly the
// same text through app/legal/[doc]/route.ts.
export default function DatenschutzPage() {
  return <LegalTextScreen title={DATENSCHUTZ.title} sections={DATENSCHUTZ.sections} updated={DATENSCHUTZ.updated} />
}
