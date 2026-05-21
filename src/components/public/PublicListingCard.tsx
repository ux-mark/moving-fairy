'use client'

import { Check, Image as ImageIcon } from 'lucide-react'
import { ListingStatus } from '@/lib/constants'
import { buyerCopy, formatPrice } from '@/lib/copy/buyer'
import { proxyImageUrl } from '@/lib/storage-url'
import { cn } from '@/lib/utils'
import type { PublicListing } from '@/mcp/listings'
import { PublicConditionBadge } from './PublicConditionBadge'
import { usePublicBundle } from './usePublicBundle'
import styles from './PublicListingCard.module.css'

type Props = {
  listing: PublicListing
  /** Called when the buyer activates the card (click, Enter, Space). The parent
   *  collection opens the right-hand panel for this slug. */
  onOpen: (slug: string) => void
}

function firstImage(listing: PublicListing): string | null {
  const fromAssessment = listing.item_assessment?.images?.[0] ?? listing.item_assessment?.image_url ?? null
  return fromAssessment
}

function imageCount(listing: PublicListing): number {
  const imgs = listing.item_assessment?.images
  if (Array.isArray(imgs) && imgs.length > 0) return imgs.length
  return listing.item_assessment?.image_url ? 1 : 0
}

export function PublicListingCard({ listing, onOpen }: Props) {
  const { has, toggle } = usePublicBundle()
  const sold = listing.listing_status === ListingStatus.SOLD
  const reserved = listing.listing_status === ListingStatus.RESERVED
  const selected = has(listing.id)
  const img = firstImage(listing)
  const count = imageCount(listing)
  const name = listing.item_assessment?.item_name ?? 'Untitled item'

  function openPanel() {
    onOpen(listing.slug)
  }

  return (
    <article
      className={cn(
        styles.card,
        sold && styles.sold,
        reserved && styles.reserved,
        selected && styles.selected,
      )}
      data-listing-id={listing.id}
    >
      <button
        type="button"
        onClick={openPanel}
        className={styles.imageWrap}
        aria-label={name}
      >
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element -- public buyer surface, no Next/Image (works on subdomain rewrites)
          <img
            src={proxyImageUrl(img)}
            alt={name}
            loading="lazy"
            decoding="async"
            className={styles.image}
          />
        ) : (
          <div className={styles.imageFallback} aria-hidden />
        )}
        {sold ? <div className={styles.soldRibbon}>{buyerCopy.soldRibbon}</div> : null}
        {reserved && !sold ? (
          <div className={styles.reservedTag}>{buyerCopy.reservedBadge}</div>
        ) : null}
        {count > 1 ? (
          <div className={styles.photoPill}>
            <ImageIcon size={11} strokeWidth={2.4} aria-hidden />
            {count} {buyerCopy.photoCountPluralSuffix}
          </div>
        ) : null}
      </button>

      {!sold ? (
        <button
          type="button"
          className={cn(styles.checkDot, selected && styles.checkDotActive)}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            toggle(listing.id)
          }}
          aria-pressed={selected}
          aria-label={selected ? buyerCopy.removeFromBundle : buyerCopy.addToBundle}
        >
          <Check size={14} strokeWidth={3} aria-hidden />
        </button>
      ) : null}

      <button type="button" onClick={openPanel} className={styles.body}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>{name}</h3>
          {!sold ? (
            <span className={styles.price}>{formatPrice(listing.asking_price, listing.currency)}</span>
          ) : null}
        </div>
        <div className={styles.metaRow}>
          <PublicConditionBadge condition={listing.condition} />
          {listing.item_assessment?.category ? (
            <span className={styles.categoryBadge}>
              {listing.item_assessment.category}
            </span>
          ) : null}
          {listing.brand ? (
            <span className={styles.subtle}>
              {listing.brand}
              {listing.model_name ? ` · ${listing.model_name}` : ''}
            </span>
          ) : null}
        </div>
        {listing.dimensions ? (
          <div className={styles.dims} title={listing.dimensions}>
            {listing.dimensions}
          </div>
        ) : null}
      </button>
    </article>
  )
}
