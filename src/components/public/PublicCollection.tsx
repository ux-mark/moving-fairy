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
 * URL-safe slug for a category label. Lowercased, non-alphanumerics collapsed
 * to a single hyphen, leading/trailing hyphens trimmed.
 *   "Kitchen & appliances" → "kitchen-appliances"
 *   "Books / media"        → "books-media"
 *   "Plants"               → "plants"
 *
 * Scoped to the currently-loaded `listings`: round-tripped via the distinct
 * category list, not a global table. Two labels that slugify to the same
 * string would collide — acceptable here because labels come from a single
 * seller's curated list and aisling-backfill is consistent.
 */
function categoryToSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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
 * The `?category=<slug>` query is orthogonal to `?item=`: changing the
 * category preserves an open panel, and closing the panel preserves the
 * active category filter.
 */
export function PublicCollection({ listings, discountTiers, contactEmail }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const bySlug = useMemo(() => {
    const map = new Map<string, PublicListing>()
    for (const l of listings) map.set(l.slug, l)
    return map
  }, [listings])

  // Distinct categories present in the loaded listings, with their counts.
  // Categories with zero listings would never appear here, so the chip rail
  // can't show a dead-end filter.
  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const l of listings) {
      const c = l.item_assessment?.category
      if (!c) continue
      counts.set(c, (counts.get(c) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, slug: categoryToSlug(label), count }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [listings])

  // Resolve the URL `?category=<slug>` back to a label by matching against the
  // current categories. Unknown slugs are treated as "no filter" (silently).
  const categoryParam = searchParams.get('category')
  const activeCategory = useMemo(() => {
    if (!categoryParam) return null
    const match = categories.find((c) => c.slug === categoryParam.toLowerCase())
    return match?.label ?? null
  }, [categoryParam, categories])

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

  const handleSelectCategory = useCallback(
    (slug: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (slug) {
        params.set('category', slug)
      } else {
        params.delete('category')
      }
      const qs = params.toString()
      router.push(qs ? `?${qs}` : '?', { scroll: false })
    },
    [router, searchParams],
  )

  const filteredListings = useMemo(() => {
    if (!activeCategory) return listings
    return listings.filter((l) => l.item_assessment?.category === activeCategory)
  }, [listings, activeCategory])

  const activeListing = selectedSlug ? bySlug.get(selectedSlug) ?? null : null
  const showChipRail = categories.length > 0
  const filteredEmpty = activeCategory !== null && filteredListings.length === 0

  return (
    <>
      {showChipRail ? (
        <nav className={styles.chipRail} aria-label="Filter by category">
          <div className={styles.chipRailInner}>
            <button
              type="button"
              className={
                activeCategory === null
                  ? `${styles.chip} ${styles.chipActive}`
                  : styles.chip
              }
              onClick={() => handleSelectCategory(null)}
              aria-pressed={activeCategory === null}
            >
              All
              <span className={styles.chipCount}>{listings.length}</span>
            </button>
            {categories.map((c) => {
              const isActive = activeCategory === c.label
              return (
                <button
                  key={c.slug}
                  type="button"
                  className={isActive ? `${styles.chip} ${styles.chipActive}` : styles.chip}
                  onClick={() => handleSelectCategory(c.slug)}
                  aria-pressed={isActive}
                >
                  {c.label}
                  <span className={styles.chipCount}>{c.count}</span>
                </button>
              )
            })}
          </div>
        </nav>
      ) : null}

      {listings.length === 0 ? (
        <section className={styles.empty} aria-label="Empty collection">
          <h2 className={styles.emptyHeading}>{buyerCopy.emptyCollectionHeading}</h2>
          <p className={styles.emptyBody}>{buyerCopy.emptyCollectionBody}</p>
        </section>
      ) : filteredEmpty ? (
        <section className={styles.empty} aria-label="No listings in this category">
          <h2 className={styles.emptyHeading}>No listings in this category.</h2>
          <button
            type="button"
            className={styles.clearFilterBtn}
            onClick={() => handleSelectCategory(null)}
          >
            Show all items
          </button>
        </section>
      ) : (
        <section className={styles.grid} aria-label="Items for sale">
          {filteredListings.map((listing) => (
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
