import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CreatePartyFlow from '@/features/create-party/CreatePartyFlow'

// The three tabs whose list has the plus button. Written out here rather than taken
// from TABS: TabNav.tsx is a 'use client' module, and a server component importing a
// value from one gets a client reference, not the array (TABS.find threw on Vercel).
const PLUS_TABS = ['/explore', '/my-parties', '/hosting']

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

  // Where ✗ returns to. Only a tab with a plus is accepted, so the query cannot send
  // anyone off the app.
  const { from } = await searchParams
  const origin = typeof from === 'string' && PLUS_TABS.includes(from) ? from : '/explore'

  return <CreatePartyFlow from={origin} userId={user.id} />
}
