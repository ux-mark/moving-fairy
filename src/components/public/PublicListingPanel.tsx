'use client'

import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import type { DiscountTier } from '@/lib/discount'
import type { PublicListing } from '@/mcp/listings'
import { PublicListingDetail } from './PublicListingDetail'
import styles from './PublicListingPanel.module.css'

type Props = {
  /** Listing to render in the drawer. `null` keeps the panel closed (unmounted). */
  listing: PublicListing | null
  discountTiers: DiscountTier[]
  contactEmail: string | null
  onClose: () => void
}

/**
 * Right-hand slide-in panel showing full listing detail without navigating away
 * from the collection. Matches the sale-fairy reference: backdrop fade, sheet
 * slides in from the right (or up from the bottom on mobile). Focus is trapped
 * inside while open and restored to the opener on close. Body scroll is locked
 * for the duration.
 */
export function PublicListingPanel({ listing, discountTiers, contactEmail, onClose }: Props) {
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const open = listing !== null

  // Capture the element that had focus when the panel opened so we can restore
  // it on close — matches expected screen-reader and keyboard behaviour.
  useEffect(() => {
    if (!open) return
    previousFocusRef.current = document.activeElement as HTMLElement | null
    // Defer focus until after the slide-in transition starts so it doesn't
    // fight the animation.
    const t = window.setTimeout(() => {
      closeBtnRef.current?.focus()
    }, 0)
    return () => {
      window.clearTimeout(t)
      previousFocusRef.current?.focus?.()
    }
  }, [open])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Body scroll lock while the panel is open. Preserves the original overflow
  // so we don't clobber another modal's lock if they ever overlap.
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  // Focus trap — Tab/Shift+Tab cycles within the sheet only.
  useEffect(() => {
    if (!open) return
    const sheet = sheetRef.current
    if (!sheet) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const focusables = sheet!.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (!first || !last) return
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (active === first || !sheet!.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    sheet.addEventListener('keydown', onKey)
    return () => sheet.removeEventListener('keydown', onKey)
  }, [open])

  if (!listing) return null

  return (
    <div className={styles.root} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        type="button"
        className={styles.backdrop}
        onClick={onClose}
        aria-label="Close listing details"
      />
      <aside ref={sheetRef} className={styles.sheet}>
        <header className={styles.header}>
          <span className={styles.headerEyebrow}>Item details</span>
          <button
            ref={closeBtnRef}
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className={styles.body}>
          <PublicListingDetail
            listing={listing}
            discountTiers={discountTiers}
            contactEmail={contactEmail}
            titleId={titleId}
            variant="panel"
          />
        </div>
      </aside>
    </div>
  )
}
