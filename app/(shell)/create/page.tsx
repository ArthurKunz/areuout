import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TABS } from '@/components/shell/TabNav'
import CreatePartyFlow from '@/features/create-party/CreatePartyFlow'

// Create Party. The proxy already sends signed-out and profile-less visitors away, but
// only optimistically: the screen guards itself, the same two checks the old
// CreatePartyScreen ran in the browser. `searchParams` is a Promise in this Next version
// and `redirect` works in a server component
// (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md,
// .../04-functions/redirect.md).
export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  // getUser, not getSession: it verifies the token with Supabase instead of trusting
  // the cookie.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
  if (!profile) redirect('/onboarding')

  // Where ✗ returns to. Only one of the four tabs is accepted, so the query cannot
  // send anyone off the app.
  const { from } = await searchParams
  const origin = TABS.find((tab) => tab.href === from)?.href ?? '/explore'

  return <CreatePartyFlow from={origin} userId={user.id} />
}
