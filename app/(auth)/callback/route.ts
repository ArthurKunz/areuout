import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sanitizeNextPath } from '@/lib/utils'

export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const token_hash = requestUrl.searchParams.get('token_hash')
    const type = requestUrl.searchParams.get('type')
    const code = requestUrl.searchParams.get('code')
    const cookieStore = await cookies()

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    )
                },
            },
        }
    )

    if (token_hash && type === 'recovery') {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'recovery' })

        // alert() does not exist in Node: this threw a ReferenceError and answered an
        // expired recovery link with a 500. On failure there is no session either, so
        // /forgot-password could not have worked anyway — /login is where a new link
        // is requested, and it is where the code branch below already sends failures.
        if (error) {
            console.error('Callback recovery error:', error)
            return NextResponse.redirect(`${requestUrl.origin}/login`)
        }

        return NextResponse.redirect(
            `${requestUrl.origin}/forgot-password`
        )
    }

    // Set when the flow started from an invite link; falls back to the parties list.
    const next = sanitizeNextPath(requestUrl.searchParams.get('next'))
    const nextQuery = next ? `?next=${encodeURIComponent(next)}` : ''

    if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        // No alert() here: this runs on the server, where it would throw.
        if (error) {
            console.error('Callback exchange error:', error)
            return NextResponse.redirect(`${requestUrl.origin}/login${nextQuery}`)
        }

        // A first-time Google user has a session but no profiles row yet, so
        // they still owe us the onboarding answers before any screen can render them.
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', user.id)
                .maybeSingle()

            if (!profile) {
                return NextResponse.redirect(`${requestUrl.origin}/onboarding${nextQuery}`)
            }
        }
    }

    return NextResponse.redirect(`${requestUrl.origin}${next ?? '/explore'}`)
}