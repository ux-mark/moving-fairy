import { NextRequest } from 'next/server'

// Proxy images from Supabase storage so they work from any device on the network
// (127.0.0.1 URLs don't resolve on mobile — this route fetches server-side and pipes through)

const isDev = process.env.NODE_ENV !== 'production'
const allowedHostnames = [
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
  ...(isDev ? ['127.0.0.1', 'localhost'] : []),
]

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

  // Only proxy requests to our own Supabase storage
  if (!allowedHostnames.includes(parsed.hostname)) {
    return new Response('Forbidden', { status: 403 })
  }

  const upstream = await fetch(url)
  if (!upstream.ok) {
    return new Response('Image not found', { status: upstream.status })
  }

  const contentType = upstream.headers.get('content-type') || 'image/webp'
  return new Response(upstream.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
