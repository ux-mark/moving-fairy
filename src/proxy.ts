import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { updateSession } from '@/lib/supabase/middleware'

// Hosts that serve the public buyer experience (Sale Fairy).
// Requests on these hosts are rewritten into the `(public)/pub/**` route group
// so they never collide with the owner app at `(app)/**`.
//
// NOTE: `pub` (not `_pub`) — Next treats folders prefixed with `_` as private
// and refuses to route them, even via internal rewrite. Plain `pub` still
// never surfaces in the URL bar because the rewrite is internal.
const PUBLIC_HOSTS = ['sale.thefairies.ie', 'sale.localhost']
const PUBLIC_PREFIX = '/pub'

function isPublicHost(host: string): boolean {
  return PUBLIC_HOSTS.some((h) => host === h || host.startsWith(`${h}:`))
}

// Public routes that don't require authentication
const PUBLIC_PATHS = [
  '/',
  '/auth/login',
  '/auth/signup',
  '/auth/callback',
  '/auth/verify',
  // Image proxy has its own SSRF protection — no auth needed
  '/api/img',
  // Public enquiry POST endpoint — buyers have no auth
  '/api/enquiries',
  // Tokenised shipment manifest share — read-only, gated by the unguessable
  // 24-char token in the URL; freight forwarders and customs need no account.
  '/share',
  // Test-only sign-in endpoint (only active in development)
  ...(process.env.NODE_ENV === 'development' ? ['/api/test-auth'] : []),
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function proxy(request: NextRequest) {
  // Hostname routing: sale.* requests serve the buyer experience via /pub/* rewrite.
  // The URL bar continues to show sale.thefairies.ie/<path> — only the internal route changes.
  // API routes are NOT rewritten — they live at /api/* on both hosts, with their own
  // auth posture decided per-route (e.g. /api/enquiries is public-by-design).
  const host = request.headers.get('host') ?? ''
  if (isPublicHost(host)) {
    const { pathname } = request.nextUrl
    if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) {
      return NextResponse.next()
    }
    const url = request.nextUrl.clone()
    if (!url.pathname.startsWith(PUBLIC_PREFIX)) {
      url.pathname = `${PUBLIC_PREFIX}${url.pathname === '/' ? '' : url.pathname}`
      return NextResponse.rewrite(url)
    }
    return NextResponse.next()
  }

  const response = await updateSession(request)

  const { pathname } = request.nextUrl

  // Always allow public routes and static assets
  if (isPublicPath(pathname)) {
    return response
  }

  // Check if user is authenticated
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {
          // Response cookies already set by updateSession above
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const host = request.headers.get('host') || request.nextUrl.host
    const proto = request.headers.get('x-forwarded-proto') || 'http'
    return NextResponse.redirect(new URL('/', `${proto}://${host}`))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
