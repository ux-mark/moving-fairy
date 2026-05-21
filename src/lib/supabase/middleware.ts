import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * IMPORTANT — cookie scoping:
 * The Supabase session cookies set below MUST stay scoped to the request host
 * (the default — no `domain` attribute). The sale.* public subdomain shares
 * the apex `thefairies.ie` with the authenticated owner app, and we explicitly
 * do NOT want the owner's auth cookie to be readable from the public buyer
 * surface. Do not add `domain: '.thefairies.ie'` here or in any `setAll`
 * helper that wraps this — it would leak the owner session to sale.*.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          supabaseResponse = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  await supabase.auth.getUser()

  return supabaseResponse
}
