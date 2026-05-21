import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { buyerCopy } from '@/lib/copy/buyer'
import type { DiscountTier } from '@/lib/discount'
import { proxyImageUrl } from '@/lib/storage-url'
import { getListingBySlug, getPublishedListings, type PublicListing } from '@/mcp/listings'
import { getSettings } from '@/mcp/settings'
import { PublicBundleBar } from '@/components/public/PublicBundleBar'
import { PublicListingDetail } from '@/components/public/PublicListingDetail'
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

  const [catalogue, settings] = await Promise.all([
    loadCatalogue(),
    loadSettings(listing.user_profile_id),
  ])

  const tiers = settings?.discount_tiers?.length ? settings.discount_tiers : FALLBACK_TIERS
  const contactEmail = settings?.contact_email ?? null

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden />
          {buyerCopy.backToCollection}
        </Link>

        <PublicListingDetail
          listing={listing}
          discountTiers={tiers}
          contactEmail={contactEmail}
          variant="page"
        />
      </div>

      <PublicBundleBar listings={catalogue} discountTiers={tiers} contactEmail={contactEmail} />
    </main>
  )
}
