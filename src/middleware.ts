import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Hosts that serve the public buyer experience (Sale Fairy).
 * Requests on these hosts are rewritten into the `(public)/_pub/**` route group
 * so they never collide with the owner app at `(app)/**`.
 *
 * The URL bar continues to show `sale.thefairies.ie/<path>` — only the internal
 * route changes.
 */
const PUBLIC_HOSTS = ['sale.thefairies.ie', 'sale.localhost']

function isPublicHost(host: string): boolean {
  return PUBLIC_HOSTS.some((h) => host === h || host.startsWith(`${h}:`))
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? ''

  if (isPublicHost(host)) {
    const url = request.nextUrl.clone()
    if (!url.pathname.startsWith('/_pub')) {
      url.pathname = `/_pub${url.pathname === '/' ? '' : url.pathname}`
      return NextResponse.rewrite(url)
    }
    // Already rewritten (e.g. internal sub-fetch) — pass through.
    return NextResponse.next()
  }

  // Owner app: refresh Supabase session as usual.
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Skip Next internals and static asset routes.
    '/((?!_next/static|_next/image|favicon.ico|api/img).*)',
  ],
}
