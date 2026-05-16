/**
 * Public buyer surface robots.txt.
 *
 * The owner app on thefairies.ie is intentionally not indexed (no public
 * routes); this is the one place we *want* crawlers — shared links for
 * specific listings should be discoverable from search.
 *
 * Served at sale.thefairies.ie/robots.txt via the middleware host rewrite.
 */
export const runtime = 'edge'

export function GET() {
  const body = `User-agent: *\nAllow: /\n`
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
