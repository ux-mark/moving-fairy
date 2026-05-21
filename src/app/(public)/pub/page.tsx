import { buyerCopy } from '@/lib/copy/buyer'
import type { DiscountTier } from '@/lib/discount'
import { getPublishedListings, type PublicListing } from '@/mcp/listings'
import { getSettings } from '@/mcp/settings'
import { PublicBundleBar } from '@/components/public/PublicBundleBar'
import { PublicListingCard } from '@/components/public/PublicListingCard'
import styles from './page.module.css'

/**
 * Default discount tiers — used when no seller_settings row exists for any
 * listing on the page. Mirrors the SQL default and the in-app default in
 * `src/mcp/settings.ts`.
 */
const FALLBACK_TIERS: DiscountTier[] = [
  { min: 3, max: 4, percent: 10 },
  { min: 5, max: 30, percent: 20 },
  { min: 31, max: null, percent: 30 },
]

// Always fetch fresh — buyers should see new listings the moment the owner
// publishes them. Phase E may revisit with a short revalidate window if we hit
// scale concerns.
export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadListings(): Promise<PublicListing[]> {
  try {
    return await getPublishedListings()
  } catch (err) {
    // DB migration may not be applied yet; empty state is friendlier than a 500.
    console.error('[public] getPublishedListings failed:', err)
    return []
  }
}

async function loadSellerSettings(listings: PublicListing[]) {
  const firstSeller = listings[0]?.user_profile_id
  if (!firstSeller) return null
  try {
    return await getSettings(firstSeller)
  } catch (err) {
    console.error('[public] getSettings failed:', err)
    return null
  }
}

export default async function PublicHomePage() {
  const listings = await loadListings()
  const settings = await loadSellerSettings(listings)

  const heading = settings?.seller_display_name?.trim() || buyerCopy.fallbackSellerName
  const tagline = settings?.pickup_location_copy?.trim() || buyerCopy.fallbackTagline
  const tiers = settings?.discount_tiers?.length ? settings.discount_tiers : FALLBACK_TIERS
  const contactEmail = settings?.contact_email ?? null

  const available = listings.filter((l) => l.listing_status !== 'sold').length

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <h1 className={styles.heading}>{heading}</h1>
          <p className={styles.tagline}>{tagline}</p>
          {listings.length > 0 ? (
            <p className={styles.availability}>
              {available} {buyerCopy.availableLabel}
            </p>
          ) : null}
        </div>
      </header>

      {listings.length === 0 ? (
        <section className={styles.empty} aria-label="Empty collection">
          <h2 className={styles.emptyHeading}>{buyerCopy.emptyCollectionHeading}</h2>
          <p className={styles.emptyBody}>{buyerCopy.emptyCollectionBody}</p>
        </section>
      ) : (
        <section className={styles.grid} aria-label="Items for sale">
          {listings.map((listing) => (
            <PublicListingCard key={listing.id} listing={listing} />
          ))}
        </section>
      )}

      <PublicBundleBar listings={listings} discountTiers={tiers} contactEmail={contactEmail} />
    </main>
  )
}
