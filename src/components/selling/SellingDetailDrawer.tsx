'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Spinner } from '@thefairies/design-system/components'

import { Drawer } from '@/components/layout/Drawer'
import { ListingEditor } from '@/components/selling/ListingEditor'
import type { ItemAssessment, Listing } from '@/types/database'

import styles from './SellingDetailDrawer.module.css'

interface SellingDetailDrawerProps {
  listingId: string
  onClose: () => void
}

/**
 * In-place listing editor — opens from the /selling grid on desktop. Fetches
 * the full listing + linked item on mount and renders the standard
 * ListingEditor inside a drawer. Saves still bounce to /selling via the
 * editor's internal navigation, which naturally drops `?listing=` and closes
 * the drawer for free.
 */
export function SellingDetailDrawer({ listingId, onClose }: SellingDetailDrawerProps) {
  const [listing, setListing] = useState<Listing | null>(null)
  const [item, setItem] = useState<ItemAssessment | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setListing(null)
    setItem(null)
    setError(null)

    async function load() {
      try {
        const listingRes = await fetch(`/api/listings/${listingId}`)
        if (!listingRes.ok) {
          throw new Error(listingRes.status === 404 ? 'Listing not found' : 'Could not load listing')
        }
        const listingData = (await listingRes.json()) as Listing
        if (cancelled) return
        setListing(listingData)

        const itemRes = await fetch(`/api/items/${listingData.item_assessment_id}`)
        if (!itemRes.ok) {
          throw new Error(itemRes.status === 404 ? 'Linked item not found' : 'Could not load item')
        }
        const itemData = (await itemRes.json()) as ItemAssessment
        if (cancelled) return
        setItem(itemData)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not load listing')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [listingId])

  const title = item?.item_name || (listing ? 'Listing' : 'Loading…')

  return (
    <Drawer
      eyebrow="Listing detail"
      title={title}
      onClose={onClose}
      size="xl"
      ariaLabel={`Edit listing ${title}`}
      headerActions={
        listing && (
          <Link
            href={`/selling/${listing.id}`}
            className={styles.openFullLink}
            title="Open full page"
          >
            <ExternalLink size={14} aria-hidden="true" />
            <span>Full view</span>
          </Link>
        )
      }
    >
      <div className={styles.body}>
        {error ? (
          <div className={styles.errorState} role="alert">
            <p className={styles.errorTitle}>Couldn&rsquo;t load this listing</p>
            <p className={styles.errorText}>{error}</p>
          </div>
        ) : listing && item ? (
          <ListingEditor listing={listing} item={item} />
        ) : (
          <div className={styles.loading} aria-busy="true">
            <Spinner size="md" />
            <p className={styles.errorText}>Loading listing…</p>
          </div>
        )}
      </div>
    </Drawer>
  )
}
