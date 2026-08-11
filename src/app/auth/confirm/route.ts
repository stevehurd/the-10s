import { NextResponse } from 'next/server'

import { normalizeNextPath } from '@/lib/auth/redirect'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const nextPath = normalizeNextPath(requestUrl.searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(
        new URL(nextPath, requestUrl.origin),
      )
    }
  }

  return NextResponse.redirect(new URL('/login?error=invalid-code', requestUrl.origin))
}
