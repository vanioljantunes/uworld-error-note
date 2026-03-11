import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '../types'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Protect all routes except auth pages and API routes
  const isAuthRoute = pathname.startsWith('/auth')
  const isApiRoute = pathname.startsWith('/api')

  if (!user && !isAuthRoute && !isApiRoute) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  if (user && (pathname === '/' || pathname.startsWith('/auth'))) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Pass user info to the proxied app via cookie
  if (user && pathname.startsWith('/app')) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .single()

    supabaseResponse.cookies.set('__gs_user', JSON.stringify({
      email: user.email,
      plan: subscription?.plan ?? 'free',
      status: subscription?.status === 'free' ? 'Active' : (subscription?.status ?? 'Active'),
    }), {
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'lax' as const,
      maxAge: 60 * 60,
    })
  }

  return supabaseResponse
}
