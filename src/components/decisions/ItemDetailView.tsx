'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Spinner } from '@thefairies/design-system/components'
import type { ItemAssessment } from '@/types'
import { ItemCard } from './ItemCard'
import { PerItemChat } from './PerItemChat'
import styles from './ItemDetailView.module.css'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ItemDetailViewProps {
  item: ItemAssessment
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ItemDetailView({ item }: ItemDetailViewProps) {
  const isCompleted = item.processing_status === 'completed'
  const isPending = item.processing_status === 'pending'
  const isProcessing = item.processing_status === 'processing'
  const isFailed = item.processing_status === 'failed'

  const itemName = item.item_name || 'Item'
  const thumbnail = item.image_url
    ? `/api/img?url=${encodeURIComponent(item.image_url)}`
    : undefined

  return (
    <div className={styles.root}>
      {/* Back navigation */}
      <nav aria-label="Breadcrumb">
        <Link href="/decisions" className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back to decisions
        </Link>
      </nav>

      {/* Item image — shown larger than the card thumbnail */}
      {thumbnail && (
        <div className={styles.itemImage}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnail}
            alt={itemName}
            className={styles.itemImg}
          />
        </div>
      )}

      {/* Clarification notice */}
      {item.needs_clarification && (
        <div className={styles.clarificationNotice} role="note">
          <p className={styles.clarificationTitle}>Aisling needs more information</p>
          <p className={styles.clarificationText}>
            Send Aisling a message below to help her complete the assessment for this item.
          </p>
        </div>
      )}

      {/* Assessment card section */}
      <div className={styles.cardSection}>
        {(isPending || isProcessing) && (
          <div className={styles.processingState} aria-busy="true">
            <Spinner size="md" />
            <p className={styles.processingTitle}>
              {isPending ? 'Waiting for Aisling...' : 'Aisling is looking at this one...'}
            </p>
            <p className={styles.processingText}>
              {isPending
                ? 'Your item is queued for assessment. This usually takes just a moment.'
                : 'Aisling is working on the assessment. It will appear here when ready.'}
            </p>
          </div>
        )}

        {isFailed && (
          <div className={styles.processingState} role="alert">
            <p className={styles.processingTitle}>Assessment failed</p>
            <p className={styles.processingText}>
              Something went wrong assessing this item. Go back to your decisions list and tap "Retry" to try again.
            </p>
          </div>
        )}

        {isCompleted && (
          <ItemCard
            item={item}
            onConfirm={() => {
              // Confirm is available on the list view; detail view is read-only for the card
            }}
            onRetry={() => {
              // Retry navigates back; triggered from list
            }}
            onClick={() => {
              // Already on detail view
            }}
          />
        )}
      </div>

      {/* Per-item chat */}
      <div className={styles.chatSection}>
        <PerItemChat itemId={item.id} itemName={itemName} />
      </div>
    </div>
  )
}
