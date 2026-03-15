'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button, Spinner } from '@thefairies/design-system/components'
import type { ItemAssessment } from '@/types'
import { ItemCard } from './ItemCard'
import { PerItemChat } from './PerItemChat'
import styles from './ItemDetailView.module.css'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ItemDetailViewProps {
  item: ItemAssessment
  onConfirm: (itemId: string) => Promise<void>
  onRetry: (itemId: string) => Promise<void>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ItemDetailView({ item, onConfirm, onRetry }: ItemDetailViewProps) {
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
              Something went wrong assessing this item. Tap below to try again.
            </p>
            <Button variant="secondary" size="sm" onClick={() => onRetry(item.id)}>
              Retry assessment
            </Button>
          </div>
        )}

        {isCompleted && (
          <ItemCard
            item={item}
            onConfirm={() => onConfirm(item.id)}
            onRetry={() => onRetry(item.id)}
            onClick={() => {
              // Already on detail view — no-op
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
