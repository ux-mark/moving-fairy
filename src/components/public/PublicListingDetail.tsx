'use client'

import { ListingStatus } from '@/lib/constants'
import { buyerCopy, formatPrice } from '@/lib/copy/buyer'
import type { DiscountTier } from '@/lib/discount'
import type { PublicListing } from '@/mcp/listings'
import type { PlantCare } from '@/types/database'
import { PublicAddToBundleButton } from './PublicAddToBundleButton'
import { PublicConditionBadge } from './PublicConditionBadge'
import { PublicInquireSingleButton } from './PublicInquireSingleButton'
import { PublicMultiImageCarousel } from './PublicMultiImageCarousel'
import styles from './PublicListingDetail.module.css'

type Props = {
  listing: PublicListing
  discountTiers: DiscountTier[]
  contactEmail: string | null
  /** Optional id applied to the heading so a parent dialog can `aria-labelledby` it. */
  titleId?: string
  /** When rendered inside the slide-in panel, layout collapses to a single column. */
  variant?: 'page' | 'panel'
}

/**
 * Shared listing-detail layout — used by both the full `[slug]` page (SEO/share
 * fallback) and the right-hand `PublicListingPanel` opened from the collection.
 * Identical structure in both surfaces means buyers see the same info whether
 * they followed a direct link or clicked a card.
 */
export function PublicListingDetail({
  listing,
  discountTiers,
  contactEmail,
  titleId,
  variant = 'page',
}: Props) {
  const sold = listing.listing_status === ListingStatus.SOLD
  const reserved = listing.listing_status === ListingStatus.RESERVED
  const name = listing.item_assessment?.item_name ?? 'Untitled item'
  const category = listing.item_assessment?.category ?? null

  const images = (() => {
    const fromAssessment = listing.item_assessment?.images
    if (Array.isArray(fromAssessment) && fromAssessment.length > 0) return fromAssessment
    const legacy = listing.item_assessment?.image_url
    return legacy ? [legacy] : []
  })()

  const specs: Array<{ label: string; value: string }> = []
  if (listing.condition) {
    specs.push({
      label: buyerCopy.specCondition,
      value: buyerCopy.conditionLabels[listing.condition],
    })
  }
  if (listing.brand) specs.push({ label: buyerCopy.specBrand, value: listing.brand })
  if (listing.model_name) specs.push({ label: buyerCopy.specModel, value: listing.model_name })
  if (listing.dimensions) specs.push({ label: buyerCopy.specDimensions, value: listing.dimensions })
  if (listing.included) specs.push({ label: buyerCopy.specIncluded, value: listing.included })

  return (
    <div className={variant === 'panel' ? styles.layoutPanel : styles.layoutPage}>
      <div className={styles.gallery}>
        <PublicMultiImageCarousel images={images} alt={name} sold={sold} />
      </div>

      <div className={styles.info}>
        <h1 id={titleId} className={styles.title}>
          {name}
        </h1>

        <div className={styles.priceRow}>
          {!sold ? (
            <span className={styles.price}>
              {formatPrice(listing.asking_price, listing.currency)}
            </span>
          ) : (
            <span className={styles.unavailable}>{buyerCopy.unavailableLabel}</span>
          )}
          <PublicConditionBadge condition={listing.condition} />
        </div>

        {category ? (
          <p className={styles.categoryLine}>
            <span className={styles.categoryLineLabel}>Category:</span> {category}
          </p>
        ) : null}

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

        {listing.item_assessment?.care ? (
          <PlantCareCallout care={listing.item_assessment.care} />
        ) : null}

        <div className={styles.actions}>
          <PublicAddToBundleButton listingId={listing.id} disabled={sold} />
          <PublicInquireSingleButton
            listing={listing}
            discountTiers={discountTiers}
            contactEmail={contactEmail}
            disabled={sold}
          />
        </div>
      </div>
    </div>
  )
}

type CareRow = {
  label: string
  text: string
  level?: 1 | 2 | 3
}

/**
 * Plant-care callout — populated by Aisling for `biosecurity_category =
 * 'plant_matter'` items. Each row shows a text label + optional 3-dot
 * intensity meter; rows are skipped when their text is absent, and the dot
 * meter is hidden when the matching `_level` is absent.
 */
function PlantCareCallout({ care }: { care: PlantCare }) {
  const rows: CareRow[] = []
  if (care.light) {
    rows.push(
      care.light_level
        ? { label: buyerCopy.careLight, text: care.light, level: care.light_level }
        : { label: buyerCopy.careLight, text: care.light },
    )
  }
  if (care.water) {
    rows.push(
      care.water_level
        ? { label: buyerCopy.careWater, text: care.water, level: care.water_level }
        : { label: buyerCopy.careWater, text: care.water },
    )
  }
  if (care.soil) rows.push({ label: buyerCopy.careSoil, text: care.soil })
  if (care.feed) {
    rows.push(
      care.feed_level
        ? { label: buyerCopy.careFeed, text: care.feed, level: care.feed_level }
        : { label: buyerCopy.careFeed, text: care.feed },
    )
  }

  if (rows.length === 0 && !care.summary) return null

  return (
    <section className={styles.care} aria-label={buyerCopy.careHeading}>
      <h2 className={styles.careHeading}>{buyerCopy.careHeading}</h2>
      {rows.length > 0 ? (
        <dl className={styles.careGrid}>
          {rows.map((row) => (
            <div key={row.label} className={styles.careRow}>
              <dt className={styles.careLabel}>{row.label}</dt>
              <dd className={styles.careValue}>
                <span className={styles.careText}>{row.text}</span>
                {row.level ? <CareLevelDots level={row.level} /> : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {care.summary ? <p className={styles.careSummary}>{care.summary}</p> : null}
    </section>
  )
}

/**
 * Three-dot intensity meter. Decorative by itself (`aria-hidden`), but
 * accompanied by a visually-hidden text label so screen readers get the
 * level out loud (e.g. "2 of 3").
 */
function CareLevelDots({ level }: { level: 1 | 2 | 3 }) {
  return (
    <span className={styles.careDots}>
      <span className={styles.careDotsVisualOnly} aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={i <= level ? styles.careDotFilled : styles.careDotEmpty}
          />
        ))}
      </span>
      <span className={styles.careDotsLabel}>{buyerCopy.careLevelLabel(level)}</span>
    </span>
  )
}
