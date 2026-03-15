'use client'

import {
  EmptyState,
  RecommendationCardSkeleton,
} from '@thefairies/design-system/components'
import type { ItemAssessment } from '@/types'
import { CostSummary } from '@/components/inventory/CostSummary'
import type { CostSummaryData } from '@/components/inventory/CostSummary'
import { ItemCard } from './ItemCard'
import { BatchUploadButton } from './BatchUploadButton'
import { TextAddInput } from './TextAddInput'
import styles from './DecisionsList.module.css'

interface DecisionsListProps {
  items: ItemAssessment[]
  isLoading: boolean
  error: string | null
  onUploadPhotos: (files: File[]) => void
  onAddByText: (name: string) => void
  onConfirm: (id: string) => void
  onRetry: (id: string) => void
  onItemClick: (id: string) => void
}

function deriveCostSummary(items: ItemAssessment[]): CostSummaryData {
  const counts_by_verdict: Record<string, number> = {}
  let totalShipCost = 0

  for (const item of items) {
    if (item.processing_status !== 'completed') continue
    if (item.verdict) {
      counts_by_verdict[item.verdict] = (counts_by_verdict[item.verdict] ?? 0) + 1
    }
    if (item.verdict === 'SHIP' && item.estimated_ship_cost != null) {
      totalShipCost += item.estimated_ship_cost
    }
  }

  return {
    counts_by_verdict,
    total_estimated_ship_cost: Math.round(totalShipCost),
    currency: 'EUR',
  }
}

export function DecisionsList({
  items,
  isLoading,
  error,
  onUploadPhotos,
  onAddByText,
  onConfirm,
  onRetry,
  onItemClick,
}: DecisionsListProps) {
  const hasItems = items.length > 0
  const costSummary = deriveCostSummary(items)
  const hasCostData = Object.values(costSummary.counts_by_verdict).some((n) => n > 0)

  // Sort: processing/pending first, then by created_at descending
  const sortedItems = [...items].sort((a, b) => {
    const isProcessingA = a.processing_status === 'pending' || a.processing_status === 'processing'
    const isProcessingB = b.processing_status === 'pending' || b.processing_status === 'processing'
    if (isProcessingA && !isProcessingB) return -1
    if (!isProcessingA && isProcessingB) return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <div className={styles.root}>
      {/* Entry points — always visible */}
      <div className={styles.entryBar}>
        <BatchUploadButton onUpload={onUploadPhotos} disabled={isLoading} />
        <TextAddInput onSubmit={onAddByText} disabled={isLoading} />
      </div>

      {/* Cost summary — only when items with completed assessments exist */}
      {hasItems && hasCostData && (
        <div className={styles.costSummaryWrap}>
          <CostSummary data={costSummary} variant="compact" />
        </div>
      )}

      {/* Main content */}
      <div className={styles.content}>
        {isLoading ? (
          <div className={styles.cardList} aria-label="Loading items" aria-busy="true">
            <RecommendationCardSkeleton />
            <RecommendationCardSkeleton />
            <RecommendationCardSkeleton />
          </div>
        ) : error ? (
          <div className={styles.errorState} role="alert">
            <p className={styles.errorText}>
              Something went wrong loading your items. Please try again.
            </p>
            <p className={styles.errorDetail}>{error}</p>
          </div>
        ) : !hasItems ? (
          <div className={styles.emptyWrap}>
            <EmptyState
              heading="No items yet"
              description="Upload photos or describe items to get started. Aisling will assess each one and help you decide what to ship, sell, or leave behind."
              ctaLabel="Upload photos"
              onCtaClick={() => {
                // Trigger the hidden file input via the BatchUploadButton's own click
                document.getElementById('batch-upload-trigger')?.click()
              }}
            />
          </div>
        ) : (
          <ul className={styles.cardList} aria-label="Your items">
            {sortedItems.map((item) => (
              <li key={item.id} className={styles.cardItem}>
                <ItemCard
                  item={item}
                  onConfirm={onConfirm}
                  onRetry={onRetry}
                  onClick={onItemClick}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
