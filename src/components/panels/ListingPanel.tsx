'use client'

import { useEffect } from 'react'
import { Spinner } from '@thefairies/design-system/components'

import { ListingEditor } from '@/components/selling/ListingEditor'
import { useItems } from '@/lib/hooks/useItems'
import { useListings } from '@/lib/hooks/useListings'

import { usePanels } from './PanelProvider'
import type { PanelContentProps } from './registry'
import styles from './ListingPanel.module.css'

/**
 * Listing detail panel (spec §3) — hosts ListingEditor, the surface
 * SellingDetailDrawer used to wrap. The listing comes from the live listings
 * hook and the linked item from the live items hook, so status/price changes
 * from other devices land without reopening. Keyed by updated_at so a
 * background change re-seeds the form.
 */
export function ListingPanel({ panelId, entityId }: PanelContentProps) {
  const { setPanelTitle } = usePanels()
  const { rows: listings, isLoading: listingsLoading } = useListings()
  const { items, isLoading: itemsLoading } = useItems()

  const listing = listings.find((l) => l.id === entityId)
  const item = listing
    ? items.find((i) => i.id === listing.item_assessment_id)
    : undefined

  const title = item?.item_name || listing?.item_assessment?.item_name || 'Listing'
  useEffect(() => {
    setPanelTitle(panelId, title)
  }, [panelId, title, setPanelTitle])

  const isLoading = listingsLoading || itemsLoading

  if (!listing || !item) {
    return (
      <div className={styles.body}>
        {isLoading ? (
          <div className={styles.state} aria-busy="true">
            <Spinner size="md" />
            <p className={styles.stateText}>Loading listing…</p>
          </div>
        ) : (
          <div className={styles.state} role="status">
            <p className={styles.stateTitle}>Listing not found</p>
            <p className={styles.stateText}>
              This listing may have been deleted, or you don&apos;t have access to it.
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={styles.body}>
      <ListingEditor
        key={`${listing.updated_at}:${item.updated_at}`}
        listing={listing}
        item={item}
      />
    </div>
  )
}
