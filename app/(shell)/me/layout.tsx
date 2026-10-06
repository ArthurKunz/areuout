import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Guards the profile and its sub-pages. The proxy already sends signed-out visitors
// away, but only optimistically: the screens guard themselves, and RLS is what protects
// the data. getUser, not getSession: it verifies the token with Supabase.
export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return children
}
