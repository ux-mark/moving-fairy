'use client'

import { useState } from 'react'
import { Sparkles, Camera } from 'lucide-react'
import {
  RecommendationCardSkeleton,
  Button,
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
  uploadError?: string | null
  onDismissUploadError?: () => void
  onUploadPhotos: (files: File[]) => Promise<void>
  onAddByText: (name: string) => void
  onConfirm: (id: string) => void
  onRetry: (id: string) => void
  onItemClick: (id: string) => void
  onRefresh?: () => void
}

function deriveCostSummary(items: ItemAssessment[]): CostSummaryData {
  const counts_by_verdict: Record<string, number> = {}
  let totalShipCost = 0
  let totalReplaceCost = 0

  for (const item of items) {
    if (item.processing_status !== 'completed') continue
    if (item.verdict) {
      counts_by_verdict[item.verdict] = (counts_by_verdict[item.verdict] ?? 0) + 1
    }
    if (item.verdict === 'SHIP' && item.estimated_ship_cost != null) {
      totalShipCost += item.estimated_ship_cost
    }
    if (item.estimated_replace_cost != null) {
      totalReplaceCost += item.estimated_replace_cost
    }
  }

  const completedItems = items.filter(i => i.processing_status === 'completed')
  const shipCurrency = completedItems.find(i => i.currency)?.currency ?? 'USD'
  const replaceCurrency = completedItems.find(i => i.replace_currency)?.replace_currency ?? 'EUR'

  return {
    counts_by_verdict,
    total_estimated_ship_cost: Math.round(totalShipCost),
    ship_currency: shipCurrency,
    total_estimated_replace_cost: Math.round(totalReplaceCost),
    replace_currency: replaceCurrency,
  }
}

export function DecisionsList({
  items,
  isLoading,
  error,
  uploadError,
  onDismissUploadError,
  onUploadPhotos,
  onAddByText,
  onConfirm,
  onRetry,
  onItemClick,
  onRefresh,
}: DecisionsListProps) {
  const hasItems = items.length > 0
  const costSummary = deriveCostSummary(items)
  const hasCostData = Object.values(costSummary.counts_by_verdict).some((n) => n > 0)
  const [showWelcomeTextInput, setShowWelcomeTextInput] = useState(false)

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
      {/* Aria-live region for dynamic announcements */}
      <span className={styles.srOnly} aria-live="polite" role="status">
        {items.length > 0 ? `${items.length} item${items.length !== 1 ? 's' : ''}` : ''}
      </span>

      {/* Entry bar — only shown when items exist */}
      {hasItems && (
        <div className={styles.entryBar}>
          <BatchUploadButton onUpload={onUploadPhotos} disabled={isLoading} />
          <TextAddInput onSubmit={onAddByText} disabled={isLoading} />
        </div>
      )}

      {/* Upload/add error banner */}
      {uploadError && (
        <div className={styles.uploadErrorBanner} role="alert">
          <p className={styles.uploadErrorText}>{uploadError}</p>
          {onDismissUploadError && (
            <button
              className={styles.uploadErrorDismiss}
              onClick={onDismissUploadError}
              aria-label="Dismiss error"
              type="button"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

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
              Something went wrong loading your items.
            </p>
            <p className={styles.errorDetail}>{error}</p>
            {onRefresh && (
              <div className={styles.errorActions}>
                <Button variant="secondary" size="sm" onClick={onRefresh}>
                  Try again
                </Button>
              </div>
            )}
          </div>
        ) : !hasItems ? (
          <div className={styles.welcomeRoot}>
            {/* Hidden BatchUploadButton provides the file input; its trigger id is used by the welcome CTA */}
            <div aria-hidden="true" style={{ display: 'none' }}>
              <BatchUploadButton onUpload={onUploadPhotos} disabled={isLoading} />
            </div>

            <Sparkles
              className={styles.welcomeIcon}
              style={{ width: 48, height: 48 }}
              aria-hidden="true"
            />

            <h1 className={styles.welcomeHeading}>Meet Aisling</h1>

            <p className={styles.welcomeDescription}>
              Aisling is your moving assistant. Snap photos of your things and she&apos;ll help you
              decide what to ship, sell, donate, or leave behind.
            </p>

            <div className={styles.welcomeCta}>
              <Button
                variant="primary"
                size="lg"
                onClick={() => document.getElementById('batch-upload-trigger')?.click()}
                disabled={isLoading}
                style={{ width: '100%' }}
              >
                <Camera style={{ width: 20, height: 20 }} aria-hidden="true" />
                Upload photos
              </Button>
            </div>

            <button
              type="button"
              className={styles.welcomeSecondary}
              onClick={() => setShowWelcomeTextInput((v) => !v)}
              aria-expanded={showWelcomeTextInput}
            >
              Or describe an item
            </button>

            {showWelcomeTextInput && (
              <div className={styles.welcomeTextInput}>
                <TextAddInput onSubmit={onAddByText} disabled={isLoading} />
              </div>
            )}
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
