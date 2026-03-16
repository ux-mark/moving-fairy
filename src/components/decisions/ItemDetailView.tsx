'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera } from 'lucide-react'
import { Button, Spinner } from '@thefairies/design-system/components'
import type { ItemAssessment } from '@/types'
import { ItemEditPanel } from './ItemEditPanel'
import { PerItemChat } from './PerItemChat'
import styles from './ItemDetailView.module.css'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ItemDetailViewProps {
  item: ItemAssessment
  onConfirm: (itemId: string) => Promise<void>
  onRetry: (itemId: string) => Promise<void>
  onItemUpdate?: (updated: ItemAssessment) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for interface compatibility; confirm flow will be re-added in a follow-up
export function ItemDetailView({ item: initialItem, onConfirm: _onConfirm, onRetry, onItemUpdate }: ItemDetailViewProps) {
  const router = useRouter()
  const [item, setItem] = useState<ItemAssessment>(initialItem)
  const [imageError, setImageError] = useState(false)

  // Keep local item in sync when parent polls and provides a newer version
  // (identified by updated_at changing, so we don't lose local edits on
  // spurious re-renders with the same timestamp).
  useEffect(() => {
    if (initialItem.updated_at !== item.updated_at) {
      setItem(initialItem)
    }
    // We intentionally depend only on initialItem — we check updated_at internally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialItem])

  const isCompleted = item.processing_status === 'completed'
  const isPending = item.processing_status === 'pending'
  const isProcessing = item.processing_status === 'processing'
  const isFailed = item.processing_status === 'failed'

  const itemName = item.item_name || 'Item'
  const thumbnail = item.image_url
    ? `/api/img?url=${encodeURIComponent(item.image_url)}`
    : undefined

  // ---------------------------------------------------------------------------
  // Chat refresh trigger — incremented after a save so the injected system
  // message becomes visible in the chat without requiring a page reload.
  // ---------------------------------------------------------------------------

  const [chatRefreshTrigger, setChatRefreshTrigger] = useState(0)

  // ---------------------------------------------------------------------------
  // Inline save handler
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async (updates: Partial<ItemAssessment>) => {
    const res = await fetch(`/api/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })

    if (!res.ok) {
      const data = await res.json() as { error?: string }
      throw new Error(data.error ?? 'Failed to save changes')
    }

    const updated = await res.json() as ItemAssessment
    setItem(updated)
    onItemUpdate?.(updated)

    // Trigger chat history re-fetch so the injected system message appears.
    // Small delay lets the server-side system message write complete first.
    setTimeout(() => setChatRefreshTrigger((n) => n + 1), 300)
  }, [item.id, onItemUpdate])

  // ---------------------------------------------------------------------------
  // Assessment update callback (from PerItemChat when Aisling reassesses)
  // ---------------------------------------------------------------------------

  const handleAssessmentUpdated = useCallback((updated: ItemAssessment) => {
    setItem(updated)
    onItemUpdate?.(updated)
  }, [onItemUpdate])

  // ---------------------------------------------------------------------------
  // Post-save navigation
  // ---------------------------------------------------------------------------

  const handleNavigateBack = useCallback(() => {
    router.push('/decisions')
  }, [router])

  // ---------------------------------------------------------------------------
  // Fullscreen chat state — lifted up so ItemDetailView controls the layout
  // ---------------------------------------------------------------------------

  const [isFullscreen, setIsFullscreen] = useState(false)
  const fullscreenTriggerRef = useRef<HTMLButtonElement>(null)

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev)
  }, [])

  // ---------------------------------------------------------------------------
  // Fullscreen layout: back bar + chat filling remaining space
  // ---------------------------------------------------------------------------

  if (isFullscreen) {
    return (
      <div className={styles.fullscreenLayout}>
        {/* Chat fills all available content area — PerItemChat renders its own "Back to {itemName}" header */}
        <PerItemChat
          itemId={item.id}
          itemName={itemName}
          thumbnailUrl={thumbnail}
          onAssessmentUpdated={handleAssessmentUpdated}
          fullscreenTriggerRef={fullscreenTriggerRef}
          isFullscreen={true}
          onToggleFullscreen={handleToggleFullscreen}
          chatRefreshTrigger={chatRefreshTrigger}
        />
      </div>
    )
  }

  return (
    <div className={styles.root}>
      {/* Back navigation */}
      <nav aria-label="Breadcrumb">
        <Link href="/decisions" className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back to decisions
        </Link>
      </nav>

      {/* Item image — larger, scrollable, object-fit: contain */}
      {thumbnail && (
        <div className={styles.itemImage}>
          {imageError ? (
            <div className={styles.imageErrorPlaceholder} role="status">
              <Camera size={32} aria-hidden="true" className={styles.imageErrorIcon} />
              <p className={styles.imageErrorText}>Photo could not be loaded</p>
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={thumbnail}
              alt={itemName}
              className={styles.itemImg}
              onError={() => setImageError(true)}
            />
          )}
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

      {/* Assessment / edit section */}
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
          <ItemEditPanel
            key={item.updated_at}
            item={item}
            shipCurrency={item.currency ?? 'USD'}
            replaceCurrency={item.replace_currency ?? 'EUR'}
            onSave={handleSave}
            onNavigateBack={handleNavigateBack}
          />
        )}
      </div>

      {/* Per-item chat (collapsible + full-screen) */}
      <div className={styles.chatSection}>
        <PerItemChat
          itemId={item.id}
          itemName={itemName}
          thumbnailUrl={thumbnail}
          onAssessmentUpdated={handleAssessmentUpdated}
          fullscreenTriggerRef={fullscreenTriggerRef}
          isFullscreen={false}
          onToggleFullscreen={handleToggleFullscreen}
          chatRefreshTrigger={chatRefreshTrigger}
        />
      </div>
    </div>
  )
}
