import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { updateSession } from '@/lib/supabase/middleware'

// Public routes that don't require authentication
const PUBLIC_PATHS = ['/', '/auth/login', '/auth/signup', '/auth/callback']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function proxy(request: NextRequest) {
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
    const homeUrl = new URL('/', request.url)
    return NextResponse.redirect(homeUrl)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
