'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { buyerCopy } from '@/lib/copy/buyer'
import { calculateDiscount, type DiscountTier } from '@/lib/discount'
import type { PublicListing } from '@/mcp/listings'
import { PublicInquiryForm } from './PublicInquiryForm'
import styles from './PublicInquireSingleButton.module.css'

type Props = {
  listing: PublicListing
  discountTiers: DiscountTier[]
  contactEmail?: string | null
  disabled?: boolean
}

/**
 * "Inquire about this item" CTA on the listing detail page — opens the same
 * inquiry form the bundle bar uses, pre-populated with just this one listing.
 * Bypasses the bundle entirely so a buyer can ask about a single item without
 * touching their existing selection.
 */
export function PublicInquireSingleButton({ listing, discountTiers, contactEmail, disabled }: Props) {
  const [open, setOpen] = useState(false)

  const subtotal = listing.asking_price ?? 0
  const { percent } = calculateDiscount(1, discountTiers)
  const total = subtotal * (1 - percent / 100)

  return (
    <>
      <button
        type="button"
        className={styles.btn}
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <MessageCircle size={16} strokeWidth={2.4} aria-hidden />
        {buyerCopy.inquireHeading}
      </button>
      <PublicInquiryForm
        open={open}
        onClose={() => setOpen(false)}
        listings={[listing]}
        subtotal={subtotal}
        total={total}
        discountPercent={percent}
        contactEmail={contactEmail}
      />
    </>
  )
}
