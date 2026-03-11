import { NextRequest } from 'next/server'

/**
 * Proxy for Supabase auth verify — solves the problem where magic link emails
 * point to 127.0.0.1 (Supabase local), which isn't reachable from mobile devices.
 *
 * This route receives the same query params as the Supabase /auth/v1/verify
 * endpoint, forwards the request server-side, then redirects the user to the
 * callback URL with the resulting auth code/fragment.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!supabaseUrl) {
    return new Response(null, {
      status: 303,
      headers: { Location: '/?error=config' },
    })
  }

  // Build the real Supabase verify URL with all original query params
  const verifyUrl = new URL('/auth/v1/verify', supabaseUrl)
  searchParams.forEach((value, key) => {
    verifyUrl.searchParams.set(key, value)
  })

  // Fetch server-side (server CAN reach 127.0.0.1)
  const upstream = await fetch(verifyUrl.toString(), { redirect: 'manual' })

  // Supabase returns a 303 with Location containing code (query) + fragment.
  // Use a raw Response to preserve the full Location including fragment.
  const location = upstream.headers.get('location')
  if (location) {
    return new Response(null, {
      status: 303,
      headers: { Location: location },
    })
  }

  return new Response(null, {
    status: 303,
    headers: { Location: '/?error=auth' },
  })
}
