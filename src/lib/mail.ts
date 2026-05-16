/**
 * Transactional email — thin provider wrapper.
 *
 * We don't pick a provider here. The route just calls `sendEnquiryNotification`
 * and we resolve a backend at runtime from env:
 *
 *   1. `RESEND_API_KEY`     → Resend (https://api.resend.com/emails)
 *   2. `MAILPACE_API_TOKEN` → Mailpace (https://app.mailpace.com/api/v1/send)
 *   3. neither              → log a warning and no-op (dev / preview)
 *
 * Swapping providers is one file. No SDK dependency — we post via `fetch` so
 * the bundle stays small and the wrapper is trivial to mock in tests.
 */
import { formatPrice } from '@/lib/copy/buyer'

const FALLBACK_FROM = 'noreply@thefairies.ie'
const FALLBACK_BASE_URL = 'https://moving.thefairies.ie'

export type SendMailInput = {
  to: string
  subject: string
  text: string
  html: string
  replyTo?: string
}

export type SendMailResult =
  | { skipped: true; reason: string }
  | { skipped: false; provider: 'resend' | 'mailpace'; id: string | undefined }

function resolveFrom(): string {
  const configured = process.env.MAIL_FROM_ADDRESS?.trim()
  if (configured) return configured
  console.warn(`[mail] MAIL_FROM_ADDRESS not set; falling back to ${FALLBACK_FROM}`)
  return FALLBACK_FROM
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const from = resolveFrom()
  const resendKey = process.env.RESEND_API_KEY?.trim()
  const mailpaceToken = process.env.MAILPACE_API_TOKEN?.trim()

  if (resendKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        reply_to: input.replyTo,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Resend send failed (${res.status}): ${body}`)
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string }
    return { skipped: false, provider: 'resend', id: data.id }
  }

  if (mailpaceToken) {
    const res = await fetch('https://app.mailpace.com/api/v1/send', {
      method: 'POST',
      headers: {
        'MailPace-Server-Token': mailpaceToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        textbody: input.text,
        htmlbody: input.html,
        replyto: input.replyTo,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Mailpace send failed (${res.status}): ${body}`)
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string | number }
    return { skipped: false, provider: 'mailpace', id: data.id !== undefined ? String(data.id) : undefined }
  }

  console.warn(
    `[mail] no provider configured; would have sent to ${input.to} subject ${JSON.stringify(input.subject)}`,
  )
  return { skipped: true, reason: 'no_provider' }
}

export type EnquiryListingSummary = {
  id: string
  title: string
}

export type SendEnquiryNotificationInput = {
  to: string
  sellerName?: string | null
  buyer: { email: string; name?: string | null }
  listings: EnquiryListingSummary[]
  message: string
  bundleSubtotalCents?: number | null
  discountPercent?: number | null
  totalCents?: number | null
  currency?: string | null
}

// Inline fallback when no Intl/locale handling is needed — used as a sanity
// guard if `formatPrice` chokes on an unusual currency code.
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  AUD: 'A$',
  GBP: '£',
  NZD: 'NZ$',
}

function formatCents(cents: number, currency: string): string {
  const dollars = cents / 100
  const formatted = formatPrice(dollars, currency)
  if (formatted) return formatted
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] ?? `${currency} `
  return `${symbol}${dollars.toFixed(2)}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function ownerOrigin(): string {
  const v = process.env.NEXT_PUBLIC_OWNER_ORIGIN?.trim()
  return v && v.length > 0 ? v.replace(/\/$/, '') : FALLBACK_BASE_URL
}

function buildSubject(listings: EnquiryListingSummary[]): string {
  if (listings.length === 1 && listings[0]) return `New inquiry: ${listings[0].title}`
  return `New inquiry: ${listings.length} listings`
}

export async function sendEnquiryNotification(
  input: SendEnquiryNotificationInput,
): Promise<SendMailResult> {
  const base = ownerOrigin()
  const currency = (input.currency ?? 'USD').toUpperCase()
  const buyerNameLine = input.buyer.name ? `${input.buyer.name} <${input.buyer.email}>` : input.buyer.email

  const lines: string[] = []
  lines.push(`New inquiry${input.sellerName ? ` for ${input.sellerName}` : ''}.`)
  lines.push('')
  lines.push(`From: ${buyerNameLine}`)
  lines.push('')
  lines.push('Listings:')
  for (const l of input.listings) {
    lines.push(`  - ${l.title} (${base}/selling/${l.id})`)
  }
  lines.push('')
  lines.push('Message:')
  lines.push(input.message)

  if (typeof input.bundleSubtotalCents === 'number') {
    lines.push('')
    lines.push(`Subtotal: ${formatCents(input.bundleSubtotalCents, currency)}`)
    if (typeof input.discountPercent === 'number' && input.discountPercent > 0) {
      lines.push(`Bundle discount: ${input.discountPercent}%`)
    }
    if (typeof input.totalCents === 'number') {
      lines.push(`Total: ${formatCents(input.totalCents, currency)}`)
    }
  }

  const text = lines.join('\n')

  const listingItemsHtml = input.listings
    .map(
      (l) =>
        `<li><a href="${escapeHtml(`${base}/selling/${l.id}`)}">${escapeHtml(l.title)}</a></li>`,
    )
    .join('')

  let pricingHtml = ''
  if (typeof input.bundleSubtotalCents === 'number') {
    const rows: string[] = []
    rows.push(
      `<tr><td style="padding:4px 12px 4px 0;">Subtotal</td><td>${escapeHtml(formatCents(input.bundleSubtotalCents, currency))}</td></tr>`,
    )
    if (typeof input.discountPercent === 'number' && input.discountPercent > 0) {
      rows.push(
        `<tr><td style="padding:4px 12px 4px 0;">Bundle discount</td><td>${input.discountPercent}%</td></tr>`,
      )
    }
    if (typeof input.totalCents === 'number') {
      rows.push(
        `<tr><td style="padding:4px 12px 4px 0;"><strong>Total</strong></td><td><strong>${escapeHtml(formatCents(input.totalCents, currency))}</strong></td></tr>`,
      )
    }
    pricingHtml = `<table style="margin-top:12px;border-collapse:collapse;">${rows.join('')}</table>`
  }

  const html = [
    `<p>New inquiry${input.sellerName ? ` for <strong>${escapeHtml(input.sellerName)}</strong>` : ''}.</p>`,
    `<p><strong>From:</strong> ${escapeHtml(buyerNameLine)}</p>`,
    `<p><strong>Listings:</strong></p>`,
    `<ul>${listingItemsHtml}</ul>`,
    `<p><strong>Message:</strong></p>`,
    `<p style="white-space:pre-wrap;">${escapeHtml(input.message)}</p>`,
    pricingHtml,
  ]
    .filter(Boolean)
    .join('\n')

  return sendMail({
    to: input.to,
    subject: buildSubject(input.listings),
    text,
    html,
    replyTo: input.buyer.email,
  })
}
