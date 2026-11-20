import { DATENSCHUTZ } from '@/features/profile/legal/datenschutz'
import { IMPRESSUM } from '@/features/profile/legal/impressum'
import { NUTZUNGSBEDINGUNGEN } from '@/features/profile/legal/nutzungsbedingungen'
import type { LegalDocument } from '@/features/profile/legal/types'

// The iOS app shows the three legal texts in its own design and loads the words here, so
// they are never older than the website's. Public like the pages themselves (proxy.ts).
const DOCUMENTS: Record<string, LegalDocument> = {
  impressum: IMPRESSUM,
  datenschutz: DATENSCHUTZ,
  nutzungsbedingungen: NUTZUNGSBEDINGUNGEN,
}

export async function GET(_request: Request, { params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params
  // hasOwn, so a name like 'constructor' is not found on the object's prototype.
  if (!Object.hasOwn(DOCUMENTS, doc)) return Response.json({ error: 'not found' }, { status: 404 })
  return Response.json(DOCUMENTS[doc])
}
