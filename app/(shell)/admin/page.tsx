import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AgentReviewScreen from '@/features/admin/AgentReviewScreen'

// The admin screen `Neue Events` (Party Agent step 4). Decided on the server against the
// allowlist private.admins (am_i_admin): anyone else typing /admin gets the normal 404,
// and every admin RPC refuses them anyway (42501). The proxy already sent signed-out
// visitors to /login.
export default async function AdminPage() {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('am_i_admin')
  if (isAdmin !== true) notFound()
  return <AgentReviewScreen />
}
