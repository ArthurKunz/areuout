import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'
import { sanitizeNextPath } from '@/lib/utils'

// Next 16 renamed the middleware convention to `proxy`; same behaviour, new filename.
// Note the docs call this an OPTIMISTIC check — it keeps signed-out visitors out of the
// app, but every screen still guards itself and RLS is what actually protects the data.

// The three legal texts, public for a reason rather than by oversight: an Impressum
// has to be reachable without signing in, and nobody can be asked to agree to terms
// they must first create an account to read — the sign-up sheet links straight to
// them. They sit at the app root instead of under /profile so this list can name them.
const LEGAL = [/^\/impressum(\/|$)/, /^\/datenschutz(\/|$)/, /^\/nutzungsbedingungen(\/|$)/]

// Everything the app has is behind an account, with these exceptions: the auth screens
// themselves, the OAuth/recovery callback, the public invite link — an anonymous
// visitor is meant to see the party there and be offered the sign-up sheet — and the
// three legal texts above.
const PUBLIC_PATHS = [/^\/login(\/|$)/, /^\/forgot-password(\/|$)/, /^\/callback(\/|$)/, /^\/e\//, ...LEGAL]

const LOGIN = /^\/login(\/|$)/
const ONBOARDING = /^\/onboarding(\/|$)/

// The two routes that legitimately run WITH a session while the account is still
// half-finished, so the profile gate below has to leave them alone: /callback is
// mid-flow and routes itself, and /forgot-password is where a recovery link lands —
// verifying that token creates a session, and bouncing it away would make the
// password reset unreachable.
//
// The legal texts join them for the same reason they are public at all: someone who
// is halfway through onboarding is exactly the person who wants to read the terms
// before finishing, and the profile gate would otherwise bounce them back.
const GATE_EXEMPT = [/^\/callback(\/|$)/, /^\/forgot-password(\/|$)/, ...LEGAL]

export async function proxy(request: NextRequest) {
  // The response is rebuilt whenever Supabase rotates the auth cookies, so a refreshed
  // token is actually written back to the browser instead of being dropped here.
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  // getUser, not getSession: this verifies the token with Supabase instead of trusting
  // whatever the cookie claims, which is the whole point of checking on the server.
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  if (!user) {
    if (PUBLIC_PATHS.some((pattern) => pattern.test(path))) return response

    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    // Same-site by construction, so it needs no sanitising on the way out — the
    // reader still runs it through sanitizeNextPath.
    if (path !== '/') url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  if (GATE_EXEMPT.some((pattern) => pattern.test(path))) return response

  // A session is only half an account: onboarding is what writes the profiles row, and
  // until it exists no screen can render this user. That gate used to live only in
  // /callback, which meant it covered Google and nothing else — an email user who
  // walked BACKWARDS out of onboarding was signed in, profile-less and stuck, because
  // signing up again hit their own existing account and signing in dropped them into
  // /parties without a profile. Deciding it here instead makes the rule hold for every
  // route and every way in, including the browser back button and a typed URL.
  const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()

  const onLogin = LOGIN.test(path)
  const onOnboarding = ONBOARDING.test(path)
  // Where the user was heading before the gate caught them. On /login that intent
  // lives in the query (an invite link put it there); anywhere else it is the path
  // itself, so onboarding hands them back to the party they came for.
  const intended = onLogin ? sanitizeNextPath(request.nextUrl.searchParams.get('next')) : path

  if (!profile && !onOnboarding) {
    const url = request.nextUrl.clone()
    url.pathname = '/onboarding'
    url.search = ''
    if (intended && intended !== '/') url.searchParams.set('next', intended)
    return NextResponse.redirect(url)
  }

  // The mirror image: a finished account has no business on the auth screens or back
  // in onboarding, which is what makes `/login` safe to navigate to from inside the app.
  if (profile && (onLogin || onOnboarding)) {
    const target = sanitizeNextPath(request.nextUrl.searchParams.get('next')) ?? '/parties'
    return NextResponse.redirect(new URL(target, request.url))
  }

  return response
}

export const config = {
  // Everything except Next's own assets and files with an extension, so the check runs
  // on pages and route handlers but not on every image and script.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.[^/]*$).*)'],
}
