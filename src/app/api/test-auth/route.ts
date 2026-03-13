/**
 * TEST-ONLY auth endpoint. Sets a valid Supabase session cookie.
 * ONLY runs in development. Will 404 in production.
 */
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse('Not Found', { status: 404 })
  }

  const email = 'playwright-test@example.com'
  const password = 'test-password-12345'

  // Sign in via the admin-style password flow using service role
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    }
  )

  if (!res.ok) {
    return new NextResponse('Sign-in failed', { status: 500 })
  }

  const session = await res.json()

  // Use the SSR client to set the session cookie properly
  const responseCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = []

  const response = NextResponse.redirect(
    new URL('/inventory', process.env.NEXTAUTH_URL || 'http://localhost:3333')
  )

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return [] },
        setAll(toSet) {
          for (const { name, value, options } of toSet) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            response.cookies.set(name, value, options as any)
          }
        },
      }
    }
  )

  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })

  return response
}
