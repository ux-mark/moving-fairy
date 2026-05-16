import { NextResponse, type NextRequest } from 'next/server'
import { createEnquiry } from '@/mcp/enquiries'

export const runtime = 'nodejs'

/**
 * Public buyer endpoint — no auth, callable from anywhere.
 *
 * Hard rules we enforce here (table-level RLS blocks anon inserts; we use the
 * service role inside `createEnquiry`, so input validation is the only guard):
 *  - email must look like an email
 *  - listing_ids must be a non-empty array of strings
 *  - message must be non-empty
 *  - honeypot field `_gotcha` must be empty (bots fill it)
 *
 * Rate limit: a process-local 5-per-minute IP bucket. Good enough for v1; a
 * real distributed limiter belongs in front of the app (Fly edge, Cloudflare)
 * once we have anything resembling traffic.
 */

type Bucket = { count: number; resetAt: number }
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60_000
const buckets = new Map<string, Bucket>()

function rateLimitKey(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function checkRateLimit(key: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { ok: true }
  }

  if (existing.count >= RATE_LIMIT_MAX) {
    return { ok: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) }
  }

  existing.count += 1
  return { ok: true }
}

// Loose email check — defers to the table-level guards and the actual delivery
// attempt later. Rejects obvious junk without blocking quirky-but-valid forms.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Payload = {
  listing_ids?: unknown
  buyer_email?: unknown
  buyer_name?: unknown
  message?: unknown
  subtotal_cents?: unknown
  discount_percent?: unknown
  total_cents?: unknown
  _gotcha?: unknown
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string' && x.length > 0)
}

function asNullableNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export async function POST(req: NextRequest) {
  let body: Payload
  try {
    body = (await req.json()) as Payload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Honeypot — return 200 silently so the bot thinks it worked.
  if (typeof body._gotcha === 'string' && body._gotcha.length > 0) {
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  if (!isStringArray(body.listing_ids) || body.listing_ids.length === 0) {
    return NextResponse.json({ error: 'listing_ids must be a non-empty array of strings' }, { status: 400 })
  }
  if (typeof body.buyer_email !== 'string' || !EMAIL_RE.test(body.buyer_email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }
  if (typeof body.message !== 'string' || body.message.trim().length === 0) {
    return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
  }

  const key = rateLimitKey(req)
  const rate = checkRateLimit(key)
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'Too many inquiries. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfter ?? 60) } },
    )
  }

  try {
    const enquiry = await createEnquiry({
      listing_ids: body.listing_ids,
      buyer_email: body.buyer_email.trim(),
      buyer_name:
        typeof body.buyer_name === 'string' && body.buyer_name.trim().length > 0
          ? body.buyer_name.trim()
          : null,
      message: body.message,
      subtotal_cents: asNullableNumber(body.subtotal_cents),
      discount_percent: asNullableNumber(body.discount_percent),
      total_cents: asNullableNumber(body.total_cents),
    })
    return NextResponse.json({ ok: true, enquiry_id: enquiry.id }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create inquiry'
    // `createEnquiry` throws on ownership mismatch / missing listings; surface
    // those to the buyer as 400s rather than 500s so they know to retry.
    const isUserError =
      message.includes('listing') ||
      message.includes('seller') ||
      message.includes('email') ||
      message.includes('Message')
    return NextResponse.json({ error: message }, { status: isUserError ? 400 : 500 })
  }
}
