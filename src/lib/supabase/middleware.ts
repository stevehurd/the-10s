import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { normalizeNextPath } from '@/lib/auth/redirect'
import { getSupabasePublicConfig } from './config'

const PUBLIC_PATHS = new Set(['/login', '/auth/confirm'])

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || pathname.startsWith('/api/cron/')
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const pathname = request.nextUrl.pathname
  if (process.env.NODE_ENV === 'development' && pathname.startsWith('/demo')) return response

  const { url, publishableKey } = getSupabasePublicConfig()

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  const { data, error } = await supabase.auth.getClaims()
  const isAuthenticated = !error && Boolean(data?.claims.sub)

  if (!isAuthenticated && !isPublicPath(pathname)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthenticated && pathname === '/login') {
    const nextPath = normalizeNextPath(request.nextUrl.searchParams.get('next'))
    const destination = request.nextUrl.clone()
    const destinationUrl = new URL(nextPath, request.nextUrl.origin)
    destination.pathname = destinationUrl.pathname
    destination.search = destinationUrl.search
    return NextResponse.redirect(destination)
  }

  return response
}
