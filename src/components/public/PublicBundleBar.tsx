'use client'

import { useMemo, useState } from 'react'
import { ShoppingBag, X } from 'lucide-react'
import { buyerCopy, formatPrice } from '@/lib/copy/buyer'
import { calculateDiscount, type DiscountTier } from '@/lib/discount'
import { cn } from '@/lib/utils'
import type { PublicListing } from '@/mcp/listings'
import { PublicInquiryForm } from './PublicInquiryForm'
import { usePublicBundle } from './usePublicBundle'
import styles from './PublicBundleBar.module.css'

type Props = {
  /** All listings visible to the buyer right now. The bar resolves selected IDs
   *  against this set; selections pointing at unknown IDs are silently dropped. */
  listings: PublicListing[]
  discountTiers: DiscountTier[]
  contactEmail?: string | null
}

function nextTierNudge(itemCount: number, tiers: DiscountTier[]): string | null {
  // Find the next tier above the current one — i.e. the smallest `min` greater
  // than itemCount that has a higher percent than the active tier.
  const current = calculateDiscount(itemCount, tiers).percent
  const candidates = tiers
    .filter((t) => t.min > itemCount && t.percent > current)
    .sort((a, b) => a.min - b.min)
  const next = candidates[0]
  if (!next) {
    return current > 0 ? buyerCopy.topTier : null
  }
  const more = next.min - itemCount
  return buyerCopy.nextTierNudge(more, next.percent)
}

export function PublicBundleBar({ listings, discountTiers, contactEmail }: Props) {
  const { ids, clear, hydrated } = usePublicBundle()
  const [formOpen, setFormOpen] = useState(false)

  const selected = useMemo(() => {
    if (!hydrated) return []
    const map = new Map(listings.map((l) => [l.id, l]))
    return ids.map((id) => map.get(id)).filter((l): l is PublicListing => !!l)
  }, [hydrated, ids, listings])

  const count = selected.length
  const subtotal = selected.reduce((sum, l) => sum + (l.asking_price ?? 0), 0)
  const { percent } = calculateDiscount(count, discountTiers)
  const total = subtotal * (1 - percent / 100)
  const saved = subtotal - total
  const nudge = nextTierNudge(count, discountTiers)

  if (count === 0) return null

  return (
    <>
      <div className={styles.bar} role="region" aria-label="Bundle summary">
        <div className={styles.left}>
          <ShoppingBag size={18} aria-hidden />
          <div className={styles.counts}>
            <div className={styles.countLine}>
              <span className={styles.countNum}>
                {count === 1 ? buyerCopy.bundleSingular : buyerCopy.bundlePlural(count)}
              </span>
              {nudge ? <span className={styles.nudge}>— {nudge}</span> : null}
            </div>
            <div className={styles.priceLine}>
              <span className={styles.subtotal}>{formatPrice(subtotal)}</span>
              {percent > 0 ? (
                <>
                  <span className={styles.arrow} aria-hidden>
                    →
                  </span>
                  <span className={styles.total}>{formatPrice(total)}</span>
                  <span className={styles.saved}>
                    ({buyerCopy.bundleSaveLabel(formatPrice(saved), percent)})
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.clearBtn}
            onClick={clear}
            aria-label={buyerCopy.bundleClear}
          >
            <X size={16} aria-hidden />
            <span className={styles.clearLabel}>{buyerCopy.bundleClear}</span>
          </button>
          <button
            type="button"
            className={cn(styles.cta)}
            onClick={() => setFormOpen(true)}
          >
            {buyerCopy.inquireButton}
          </button>
        </div>
      </div>

      <PublicInquiryForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        listings={selected}
        subtotal={subtotal}
        total={total}
        discountPercent={percent}
        contactEmail={contactEmail}
      />
    </>
  )
}
