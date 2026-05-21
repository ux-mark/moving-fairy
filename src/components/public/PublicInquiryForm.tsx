'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { X, CheckCircle2, AlertCircle } from 'lucide-react'
import { buyerCopy, formatPrice } from '@/lib/copy/buyer'
import { cn } from '@/lib/utils'
import type { PublicListing } from '@/mcp/listings'
import styles from './PublicInquiryForm.module.css'

type Props = {
  open: boolean
  onClose: () => void
  listings: PublicListing[]
  subtotal: number
  total: number
  discountPercent: number
  contactEmail?: string | null | undefined
}

function buildMessageTemplate(args: {
  listings: PublicListing[]
  subtotal: number
  total: number
  discountPercent: number
}): string {
  const { listings, subtotal, total, discountPercent } = args
  const lines = listings.map((l) => {
    const name = l.item_assessment?.item_name ?? 'Item'
    return `  • ${name} — ${formatPrice(l.asking_price, l.currency)}`
  })
  const summary =
    discountPercent > 0
      ? `Subtotal: ${formatPrice(subtotal)}\nBundle discount (${discountPercent}%): -${formatPrice(subtotal - total)}\nTotal: ${formatPrice(total)}`
      : `Total: ${formatPrice(subtotal)}`
  return `Hi — I'd like to set up a pickup for:\n\n${lines.join('\n')}\n\n${summary}\n\nI'm available: [your availability]\n\nThanks,\n[your name]`
}

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'success' }
  | { kind: 'error'; message: string }

export function PublicInquiryForm({
  open,
  onClose,
  listings,
  subtotal,
  total,
  discountPercent,
  contactEmail,
}: Props) {
  const emailId = useId()
  const nameId = useId()
  const messageId = useId()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [submit, setSubmit] = useState<SubmitState>({ kind: 'idle' })

  // Re-template message whenever the selection changes while the form is open.
  useEffect(() => {
    if (!open) return
    setMessage(buildMessageTemplate({ listings, subtotal, total, discountPercent }))
    setSubmit({ kind: 'idle' })
  }, [open, listings, subtotal, total, discountPercent])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const headerLabel = useMemo(() => {
    const n = listings.length
    return n === 1 ? buyerCopy.bundleSingular : buyerCopy.bundlePlural(n)
  }, [listings.length])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submit.kind === 'sending') return

    if (!email.includes('@')) {
      setSubmit({ kind: 'error', message: 'A valid email is required.' })
      return
    }
    if (message.trim().length === 0) {
      setSubmit({ kind: 'error', message: 'Please include a message.' })
      return
    }

    const formEl = e.currentTarget
    const gotcha = (formEl.elements.namedItem('_gotcha') as HTMLInputElement | null)?.value ?? ''

    setSubmit({ kind: 'sending' })
    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_ids: listings.map((l) => l.id),
          buyer_email: email,
          buyer_name: name || undefined,
          message,
          subtotal_cents: Math.round(subtotal * 100),
          discount_percent: discountPercent,
          total_cents: Math.round(total * 100),
          _gotcha: gotcha,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? `Request failed (${res.status})`)
      }
      setSubmit({ kind: 'success' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      setSubmit({ kind: 'error', message: msg })
    }
  }

  const mailto = useMemo(() => {
    if (!contactEmail) return null
    const subject = `Inquiry — ${headerLabel}`
    return `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
  }, [contactEmail, headerLabel, message])

  if (!open) return null

  return (
    <div className={styles.root} role="dialog" aria-modal="true" aria-labelledby={`${emailId}-heading`}>
      <button type="button" className={styles.backdrop} onClick={onClose} aria-label="Close" />
      <div className={styles.sheet}>
        <header className={styles.header}>
          <span id={`${emailId}-heading`} className={styles.headerTitle}>
            {buyerCopy.inquireBundleHeading}
          </span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.summary}>
            <div className={styles.summaryLine}>
              {headerLabel} {listings.length === 1 ? 'selected' : 'selected'}
            </div>
            <div className={styles.summarySub}>
              {discountPercent > 0
                ? `${formatPrice(subtotal)} subtotal · ${formatPrice(total)} after ${discountPercent}% discount`
                : `${formatPrice(subtotal)} total`}
            </div>
          </div>

          {submit.kind === 'success' ? (
            <div className={cn(styles.status, styles.statusSuccess)} role="status">
              <CheckCircle2 size={20} aria-hidden />
              <div>
                <div className={styles.statusHeading}>{buyerCopy.successHeading}</div>
                <div className={styles.statusBody}>{buyerCopy.successBody}</div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className={styles.field}>
                <label htmlFor={emailId} className={styles.label}>
                  {buyerCopy.emailLabel}
                </label>
                <input
                  id={emailId}
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={buyerCopy.emailPlaceholder}
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor={nameId} className={styles.label}>
                  {buyerCopy.nameLabel}{' '}
                  <span className={styles.labelHint}>— {buyerCopy.nameHint}</span>
                </label>
                <input
                  id={nameId}
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor={messageId} className={styles.label}>
                  {buyerCopy.messageLabel}{' '}
                  <span className={styles.labelHint}>— {buyerCopy.messageHint}</span>
                </label>
                <textarea
                  id={messageId}
                  required
                  rows={12}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={styles.textarea}
                />
              </div>

              {/* Honeypot — bots fill, humans don't. */}
              <input
                type="text"
                name="_gotcha"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden
                className={styles.honeypot}
              />

              {submit.kind === 'error' ? (
                <div className={cn(styles.status, styles.statusError)} role="alert">
                  <AlertCircle size={18} aria-hidden />
                  <div>
                    <div className={styles.statusHeading}>{buyerCopy.errorHeading}</div>
                    <div className={styles.statusBody}>{submit.message}</div>
                    {mailto ? (
                      <a href={mailto} className={styles.statusLink}>
                        {buyerCopy.mailtoFallbackLabel}
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className={styles.actions}>
                <button type="button" className={styles.cancelBtn} onClick={onClose}>
                  {buyerCopy.cancelCta}
                </button>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={submit.kind === 'sending'}
                >
                  {submit.kind === 'sending' ? buyerCopy.sendingCta : buyerCopy.sendCta}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
