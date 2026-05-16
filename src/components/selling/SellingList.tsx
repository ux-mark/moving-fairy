'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Tag, Plus } from 'lucide-react'
import { Button, EmptyState } from '@thefairies/design-system/components'

import { proxyImageUrl } from '@/lib/storage-url'
import { ListingStatus } from '@/lib/constants'
import { ownerCopy } from '@/lib/copy/owner'
import type { OwnerListing } from '@/mcp/listings'
import { cn } from '@/lib/utils'

import styles from './SellingList.module.css'

type StatusFilter = 'all' | 'draft' | 'published' | 'reserved' | 'sold'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all',       label: ownerCopy.selling.filters.all },
  { value: 'draft',     label: ownerCopy.selling.filters.draft },
  { value: 'published', label: ownerCopy.selling.filters.published },
  { value: 'reserved',  label: ownerCopy.selling.filters.reserved },
  { value: 'sold',      label: ownerCopy.selling.filters.sold },
]

const STATUS_LABEL: Record<string, string> = {
  draft:     ownerCopy.selling.status.draft,
  published: ownerCopy.selling.status.published,
  reserved:  ownerCopy.selling.status.reserved,
  sold:      ownerCopy.selling.status.sold,
}

interface Props {
  listings: OwnerListing[]
  eligibleCount: number
}

function formatPrice(amount: number | null, currency: string): string {
  if (amount === null || amount === undefined) return '—'
  try {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}

export function SellingList({ listings, eligibleCount }: Props) {
  const router = useRouter()
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [markingSold, setMarkingSold] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (filter === 'all') return listings
    return listings.filter((l) => l.listing_status === filter)
  }, [listings, filter])

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: listings.length,
      draft: 0,
      published: 0,
      reserved: 0,
      sold: 0,
    }
    for (const l of listings) {
      const key = l.listing_status as StatusFilter
      if (key in c) c[key]++
    }
    return c
  }, [listings])

  const handleMarkSold = async (id: string) => {
    setMarkingSold(id)
    try {
      const res = await fetch(`/api/listings/${id}/mark-sold`, { method: 'POST' })
      if (res.ok) router.refresh()
    } finally {
      setMarkingSold(null)
    }
  }

  const handleNewListing = () => {
    router.push('/selling/new')
  }

  if (listings.length === 0) {
    return (
      <div className={styles.root}>
        <header className={styles.header}>
          <h1 className={styles.heading}>{ownerCopy.selling.heading}</h1>
        </header>
        <div className={styles.emptyWrap}>
          <EmptyState
            variant="branded"
            icon={<Tag size={32} aria-hidden="true" />}
            heading={ownerCopy.selling.emptyHeading}
            description={ownerCopy.selling.emptyDescription}
            {...(eligibleCount > 0
              ? {
                  ctaLabel: ownerCopy.selling.newListing,
                  onCtaClick: handleNewListing,
                }
              : {})}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <h1 className={styles.heading}>
            {ownerCopy.selling.heading}
            <span className={styles.countBadge} aria-label={`${listings.length} listings`}>
              {listings.length}
            </span>
          </h1>
          <Button
            variant="primary"
            size="md"
            onClick={handleNewListing}
            disabled={eligibleCount === 0}
            {...(eligibleCount === 0
              ? { title: 'Mark an item SELL in Items first.' }
              : {})}
          >
            <Plus size={16} aria-hidden="true" />
            {ownerCopy.selling.newListing}
          </Button>
        </div>
      </header>

      <div className={styles.filters} role="tablist" aria-label="Filter listings by status">
        {STATUS_FILTERS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={filter === opt.value}
            className={cn(styles.filterChip, filter === opt.value && styles.filterChipActive)}
            onClick={() => setFilter(opt.value)}
          >
            <span>{opt.label}</span>
            <span className={styles.filterCount}>({counts[opt.value]})</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className={styles.emptyFilter} role="status">
          No listings match this filter.
        </p>
      ) : (
        <ul className={styles.grid}>
          {filtered.map((listing) => {
            const item = listing.item_assessment
            const firstImage = item?.images?.[0] ?? item?.image_url ?? null
            const name = item?.item_name ?? 'Untitled item'
            const isPublished = listing.listing_status === ListingStatus.PUBLISHED
            const isReserved = listing.listing_status === ListingStatus.RESERVED

            return (
              <li key={listing.id} className={styles.card}>
                <Link href={`/selling/${listing.id}`} className={styles.cardLink}>
                  <div className={styles.thumbWrap}>
                    {firstImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={proxyImageUrl(firstImage)}
                        alt={name}
                        className={styles.thumb}
                        loading="lazy"
                      />
                    ) : (
                      <div className={styles.thumbPlaceholder} aria-hidden="true">
                        <Tag size={24} />
                      </div>
                    )}
                    <span
                      className={cn(
                        styles.statusPill,
                        styles[`status_${listing.listing_status}`],
                      )}
                    >
                      {STATUS_LABEL[listing.listing_status] ?? listing.listing_status}
                    </span>
                  </div>
                  <div className={styles.cardBody}>
                    <h2 className={styles.cardName}>{name}</h2>
                    <p className={styles.cardPrice}>
                      {formatPrice(listing.asking_price, listing.currency)}
                    </p>
                  </div>
                </Link>
                {(isPublished || isReserved) && (
                  <div className={styles.cardActions}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleMarkSold(listing.id)}
                      disabled={markingSold === listing.id}
                    >
                      {markingSold === listing.id ? 'Marking…' : ownerCopy.selling.actions.markSold}
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
