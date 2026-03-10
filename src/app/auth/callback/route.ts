import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

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
          return NextResponse.redirect(new URL('/chat', request.url))
        } else {
          return NextResponse.redirect(new URL('/onboarding', request.url))
        }
      }
    }
  }

  // Auth error — redirect to home with error
  return NextResponse.redirect(new URL(`/?error=auth`, request.url))
}
