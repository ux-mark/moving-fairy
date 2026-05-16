import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ListingStatus } from '@/lib/constants'
import { buyerCopy, formatPrice } from '@/lib/copy/buyer'
import type { DiscountTier } from '@/lib/discount'
import { proxyImageUrl } from '@/lib/storage-url'
import { getListingBySlug, getPublishedListings, type PublicListing } from '@/mcp/listings'
import { getSettings } from '@/mcp/settings'
import { PublicAddToBundleButton } from '@/components/public/PublicAddToBundleButton'
import { PublicBundleBar } from '@/components/public/PublicBundleBar'
import { PublicConditionBadge } from '@/components/public/PublicConditionBadge'
import { PublicInquireSingleButton } from '@/components/public/PublicInquireSingleButton'
import { PublicMultiImageCarousel } from '@/components/public/PublicMultiImageCarousel'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const FALLBACK_TIERS: DiscountTier[] = [
  { min: 3, max: 4, percent: 10 },
  { min: 5, max: 30, percent: 20 },
  { min: 31, max: null, percent: 30 },
]

type Params = Promise<{ slug: string }>

async function loadListing(slug: string): Promise<PublicListing | null> {
  try {
    return await getListingBySlug(slug)
  } catch (err) {
    console.error('[public] getListingBySlug failed:', err)
    return null
  }
}

async function loadCatalogue(): Promise<PublicListing[]> {
  // Needed for the bundle bar to resolve selected IDs into objects with prices.
  try {
    return await getPublishedListings()
  } catch (err) {
    console.error('[public] getPublishedListings failed:', err)
    return []
  }
}

async function loadSettings(userProfileId: string | undefined) {
  if (!userProfileId) return null
  try {
    return await getSettings(userProfileId)
  } catch (err) {
    console.error('[public] getSettings failed:', err)
    return null
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const listing = await loadListing(slug)
  if (!listing) return { title: 'Item not found' }

  const name = listing.item_assessment?.item_name ?? 'Item for sale'
  const detailsSource = listing.details ?? listing.item_assessment?.item_description ?? ''
  const description = detailsSource.slice(0, 160) || `${name} — available for pickup.`
  const firstImage = listing.item_assessment?.images?.[0] ?? listing.item_assessment?.image_url
  const ogImage = firstImage ? proxyImageUrl(firstImage) : undefined

  return {
    title: name,
    description,
    openGraph: {
      title: name,
      description,
      images: ogImage ? [ogImage] : undefined,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: name,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  }
}

export default async function PublicListingDetailPage({ params }: { params: Params }) {
  const { slug } = await params
  const listing = await loadListing(slug)
  if (!listing) notFound()

  const sold = listing.listing_status === ListingStatus.SOLD
  const reserved = listing.listing_status === ListingStatus.RESERVED
  const name = listing.item_assessment?.item_name ?? 'Untitled item'
  const images = (() => {
    const fromAssessment = listing.item_assessment?.images
    if (Array.isArray(fromAssessment) && fromAssessment.length > 0) return fromAssessment
    const legacy = listing.item_assessment?.image_url
    return legacy ? [legacy] : []
  })()

  const [catalogue, settings] = await Promise.all([
    loadCatalogue(),
    loadSettings(listing.user_profile_id),
  ])

  const tiers = settings?.discount_tiers?.length ? settings.discount_tiers : FALLBACK_TIERS
  const contactEmail = settings?.contact_email ?? null

  const specs: Array<{ label: string; value: string }> = []
  if (listing.condition) {
    specs.push({ label: buyerCopy.specCondition, value: buyerCopy.conditionLabels[listing.condition] })
  }
  if (listing.brand) specs.push({ label: buyerCopy.specBrand, value: listing.brand })
  if (listing.model_name) specs.push({ label: buyerCopy.specModel, value: listing.model_name })
  if (listing.dimensions) specs.push({ label: buyerCopy.specDimensions, value: listing.dimensions })
  if (listing.included) specs.push({ label: buyerCopy.specIncluded, value: listing.included })

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden />
          {buyerCopy.backToCollection}
        </Link>

        <div className={styles.layout}>
          <div className={styles.gallery}>
            <PublicMultiImageCarousel images={images} alt={name} sold={sold} />
          </div>

          <div className={styles.info}>
            <h1 className={styles.title}>{name}</h1>

            <div className={styles.priceRow}>
              {!sold ? (
                <span className={styles.price}>{formatPrice(listing.asking_price, listing.currency)}</span>
              ) : (
                <span className={styles.unavailable}>{buyerCopy.unavailableLabel}</span>
              )}
              <PublicConditionBadge condition={listing.condition} />
            </div>

            {reserved && !sold ? (
              <p className={styles.statusNote}>{buyerCopy.itemReserved}</p>
            ) : null}
            {sold ? <p className={styles.statusNote}>{buyerCopy.itemSold}</p> : null}

            {listing.details ? <p className={styles.details}>{listing.details}</p> : null}

            {specs.length > 0 ? (
              <section className={styles.specs} aria-label={buyerCopy.detailsHeading}>
                <h2 className={styles.specsHeading}>{buyerCopy.detailsHeading}</h2>
                <dl className={styles.specGrid}>
                  {specs.map((s) => (
                    <div key={s.label} className={styles.specRow}>
                      <dt className={styles.specLabel}>{s.label}</dt>
                      <dd className={styles.specValue}>{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            <div className={styles.actions}>
              <PublicAddToBundleButton listingId={listing.id} disabled={sold} />
              <PublicInquireSingleButton
                listing={listing}
                discountTiers={tiers}
                contactEmail={contactEmail}
                disabled={sold}
              />
            </div>
          </div>
        </div>
      </div>

      <PublicBundleBar listings={catalogue} discountTiers={tiers} contactEmail={contactEmail} />
    </main>
  )
}
