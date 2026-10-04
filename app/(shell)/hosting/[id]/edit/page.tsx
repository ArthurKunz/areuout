import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditPartyFlow from '@/features/edit-party/EditPartyFlow'
import { FitSheet } from '@/components/shell/Shell'

// Edit Party, opened through bearbeiten in the Hosting detail. Not a tab root, so the
// shell hides the navigation and the slider. The same two guards as Create Party; the
// flow itself sends anyone but the host back to Hosting, and RLS holds the save.
// `params` is a Promise in this Next version
// (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md).
export default async function EditPartyPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  // getUser, not getSession: it verifies the token with Supabase instead of trusting
  // the cookie.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
  if (!profile) redirect('/onboarding')

  const { id } = await params

  // The form fits its content, as the create flow does.
  return (
    <>
      <FitSheet />
      <EditPartyFlow partyId={id} userId={user.id} />
    </>
  )
}
