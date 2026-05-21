'use client'

import { useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { buyerCopy } from '@/lib/copy/buyer'
import type { DiscountTier } from '@/lib/discount'
import type { PublicListing } from '@/mcp/listings'
import { PublicBundleBar } from './PublicBundleBar'
import { PublicListingCard } from './PublicListingCard'
import { PublicListingPanel } from './PublicListingPanel'
import styles from './PublicCollection.module.css'

type Props = {
  listings: PublicListing[]
  discountTiers: DiscountTier[]
  contactEmail: string | null
}

/**
 * Buyer-side collection grid + slide-in detail panel + bundle bar.
 *
 * Owns the `selectedSlug` state for the panel and keeps it in sync with the
 * URL's `?item=<slug>` query so:
 *   • visiting `/?item=foo` opens the panel for `foo` on load
 *   • browser back/forward toggles the panel (history entries)
 *   • sharing the URL preserves the open panel
 *
 * When a slug in the URL isn't present in the loaded `listings` (stale link),
 * we silently leave the panel closed — the `/[slug]` page remains as a
 * full-render fallback for those cases.
 */
export function PublicCollection({ listings, discountTiers, contactEmail }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const bySlug = useMemo(() => {
    const map = new Map<string, PublicListing>()
    for (const l of listings) map.set(l.slug, l)
    return map
  }, [listings])

  // The panel state is derived directly from the URL — no local mirror. This
  // means browser back/forward and `router.push` are the single source of
  // truth, and it keeps history entries honest without an effect-driven sync.
  const selectedSlug = searchParams.get('item')

  const handleOpen = useCallback(
    (slug: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('item', slug)
      router.push(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  const handleClose = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('item')
    const qs = params.toString()
    router.push(qs ? `?${qs}` : '?', { scroll: false })
  }, [router, searchParams])

  const activeListing = selectedSlug ? bySlug.get(selectedSlug) ?? null : null

  return (
    <>
      {listings.length === 0 ? (
        <section className={styles.empty} aria-label="Empty collection">
          <h2 className={styles.emptyHeading}>{buyerCopy.emptyCollectionHeading}</h2>
          <p className={styles.emptyBody}>{buyerCopy.emptyCollectionBody}</p>
        </section>
      ) : (
        <section className={styles.grid} aria-label="Items for sale">
          {listings.map((listing) => (
            <PublicListingCard key={listing.id} listing={listing} onOpen={handleOpen} />
          ))}
        </section>
      )}

      <PublicListingPanel
        listing={activeListing}
        discountTiers={discountTiers}
        contactEmail={contactEmail}
        onClose={handleClose}
      />

      <PublicBundleBar
        listings={listings}
        discountTiers={discountTiers}
        contactEmail={contactEmail}
      />
    </>
  )
}
