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

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')

  if (!url) {
    return new Response('Missing url param', { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return new Response('Invalid url', { status: 400 })
  }

  // Only allow HTTPS — reject http, data:, blob:, etc.
  if (parsed.protocol !== 'https:') {
    return new Response('Only HTTPS URLs are allowed', { status: 400 })
  }

  // Block private/loopback IP ranges (SSRF protection)
  if (isPrivateHostname(parsed.hostname)) {
    return new Response('Forbidden', { status: 403 })
  }

  let upstream: Response
  try {
    upstream = await fetch(url)
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
