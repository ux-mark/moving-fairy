import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

/**
 * Build a redirect URL using the real Host header instead of request.url,
 * which resolves to 0.0.0.0 when Next.js is bound to all interfaces.
 */
function redirectTo(path: string, request: NextRequest) {
  const host = request.headers.get('host') || request.nextUrl.host
  const proto = request.headers.get('x-forwarded-proto') || 'http'
  return NextResponse.redirect(new URL(path, `${proto}://${host}`))
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const admin = createAdmin(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        const { data: profile } = await admin
          .from('user_profile')
          .select('id')
          .eq('auth_user_id', user.id)
          .single()

        if (profile) {
          return redirectTo('/decisions', request)
        } else {
          return redirectTo('/onboarding', request)
        }
      }
    }
  }

  // Auth error — redirect to home with error
  return redirectTo('/?error=auth', request)
}
