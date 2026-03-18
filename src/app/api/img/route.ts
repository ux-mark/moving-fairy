import { NextRequest } from 'next/server'

// Image proxy — fetches upstream images server-side and pipes them through.
// This is needed because Supabase storage URLs on localhost (127.0.0.1) don't
// resolve on mobile devices on the same network.
//
// SSRF protection: only HTTPS URLs are accepted; private/loopback IPs are rejected.

const PRIVATE_IP_PATTERN =
  /^(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|127\.\d+\.\d+\.\d+|::1|localhost)$/i

function isPrivateHostname(hostname: string): boolean {
  return PRIVATE_IP_PATTERN.test(hostname)
}

/**
 * Check if a URL belongs to our Supabase instance (trusted origin).
 *
 * In local dev, the Supabase URL stored in .env.local may use 127.0.0.1 while
 * image_urls stored in the DB use the LAN IP (e.g. 192.168.x.x) because
 * start-dev.sh overrides NEXT_PUBLIC_SUPABASE_URL at runtime. We match on
 * port + the Supabase storage path pattern to handle both hostnames.
 */
function isSupabaseUrl(parsed: URL): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return false
  try {
    const supabase = new URL(supabaseUrl)
    // Exact hostname match (production, or when env var matches)
    if (parsed.hostname === supabase.hostname && parsed.port === supabase.port) {
      return true
    }
    // Dev fallback: same port + Supabase storage path + private IP
    // This handles the 127.0.0.1 vs LAN IP mismatch in local dev
    if (
      parsed.port === supabase.port &&
      parsed.pathname.startsWith('/storage/v1/') &&
      isPrivateHostname(parsed.hostname)
    ) {
      return true
    }
    return false
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')

  if (!url) {
    return new Response('Missing url param', { status: 400 })
  }

  // Handle relative storage paths (new format: "item-images/{profile_id}/{uuid}.webp")
  // Expand to a full URL using the current Supabase base so no IP is hardcoded.
  let fetchUrl = url
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!base) {
      return new Response('Supabase URL not configured', { status: 500 })
    }
    fetchUrl = `${base}/storage/v1/object/public/${url}`
  }

  let parsed: URL
  try {
    parsed = new URL(fetchUrl)
  } catch {
    return new Response('Invalid url', { status: 400 })
  }

  // Allow Supabase storage URLs (trusted origin — may be HTTP in local dev)
  const trusted = isSupabaseUrl(parsed)

  // Only allow HTTPS — reject http, data:, blob:, etc. (Supabase URLs exempt)
  if (!trusted && parsed.protocol !== 'https:') {
    return new Response('Only HTTPS URLs are allowed', { status: 400 })
  }

  // Block private/loopback IP ranges — SSRF protection (Supabase URLs exempt)
  if (!trusted && isPrivateHostname(parsed.hostname)) {
    return new Response('Forbidden', { status: 403 })
  }

  let upstream: Response
  try {
    upstream = await fetch(fetchUrl)
  } catch {
    return new Response('Failed to fetch image', { status: 502 })
  }

  if (!upstream.ok) {
    return new Response('Failed to fetch image', { status: 502 })
  }

  const contentType = upstream.headers.get('content-type') || 'image/webp'
  return new Response(upstream.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  })
}
