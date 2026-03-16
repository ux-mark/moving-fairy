'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Camera, Sparkles, ChevronUp } from 'lucide-react'
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
  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const backHref = from === 'boxes' ? '/boxes' : '/decisions'
  const backLabel = from === 'boxes' ? 'Back to boxes' : 'Back to decisions'

  const [item, setItem] = useState<ItemAssessment>(initialItem)
  const [imageError, setImageError] = useState(false)

  // ---------------------------------------------------------------------------
  // Box data for assignment selector
  // ---------------------------------------------------------------------------

  const [boxes, setBoxes] = useState<Array<{id: string, label: string, status: string, items: Array<{item_assessment_id: string | null}>}>>([])

  useEffect(() => {
    fetch('/api/boxes')
      .then(res => res.ok ? res.json() : [])
      .then(data => setBoxes(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  // Keep local item in sync when parent polls and provides a newer version
  useEffect(() => {
    if (initialItem.updated_at !== item.updated_at) {
      setItem(initialItem)
    }
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
  // Chat refresh trigger
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
    router.push(backHref)
  }, [router, backHref])

  // ---------------------------------------------------------------------------
  // Fullscreen chat state — lifted up so ItemDetailView controls the layout.
  // IMPORTANT: We render a SINGLE PerItemChat instance to avoid unmounting
  // during fullscreen toggle, which would kill in-flight SSE streams.
  // ---------------------------------------------------------------------------

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isChatExpanded, setIsChatExpanded] = useState(false)
  const fullscreenTriggerRef = useRef<HTMLButtonElement>(null)

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev)
  }, [])

  // ---------------------------------------------------------------------------
  // Single render path — item content is hidden when fullscreen, but
  // PerItemChat stays mounted in the same tree position at all times.
  // ---------------------------------------------------------------------------

  // Derive box data for ItemEditPanel
  const currentBoxId = boxes.find(box =>
    box.items?.some(bi => bi.item_assessment_id === item.id)
  )?.id ?? ''
  const availableBoxes = boxes.filter(b => b.status === 'packing')

  return (
    <div className={isFullscreen ? styles.fullscreenLayout : styles.root}>
      {/* Item content — hidden during fullscreen chat */}
      {!isFullscreen && (
        <div className={styles.itemContent}>
          <nav aria-label="Breadcrumb">
            <Link href={backHref} className={styles.backLink}>
              <ArrowLeft size={16} aria-hidden="true" />
              {backLabel}
            </Link>
          </nav>

          {thumbnail ? (
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
          ) : isCompleted ? (
            <div className={styles.noImagePlaceholder}>
              <Camera size={24} aria-hidden="true" className={styles.noImageIcon} />
              <p className={styles.noImageText}>No photo for this item</p>
            </div>
          ) : null}

          {item.needs_clarification && (
            <div className={styles.clarificationNotice} role="note">
              <p className={styles.clarificationTitle}>Aisling needs more information</p>
              <p className={styles.clarificationText}>
                Send Aisling a message below to help her complete the assessment for this item.
              </p>
            </div>
          )}

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
                backLabel={backLabel}
                availableBoxes={availableBoxes}
                currentBoxId={currentBoxId}
              />
            )}
          </div>
        </div>
      )}

      {/* Per-item chat — SINGLE instance, never unmounts on fullscreen/sheet toggle */}
      <div className={
        isFullscreen
          ? styles.chatSectionFullscreen
          : isChatExpanded
            ? styles.chatSheetExpanded
            : styles.chatSheet
      }>
        {/* Collapsed bar — shown only when not fullscreen and chat is collapsed */}
        {!isFullscreen && !isChatExpanded && (
          <button
            type="button"
            className={styles.chatBar}
            onClick={() => setIsChatExpanded(true)}
            aria-label="Open chat with Aisling"
          >
            <Sparkles size={18} aria-hidden="true" className={styles.chatBarIcon} />
            <span className={styles.chatBarText}>Chat with Aisling</span>
            <ChevronUp size={16} aria-hidden="true" />
          </button>
        )}

        {/* Chat body — hidden (not unmounted) when sheet is collapsed */}
        <div className={
          !isFullscreen && !isChatExpanded
            ? styles.chatBodyHidden
            : styles.chatBody
        }>
          <PerItemChat
            itemId={item.id}
            itemName={itemName}
            thumbnailUrl={thumbnail}
            onAssessmentUpdated={handleAssessmentUpdated}
            fullscreenTriggerRef={fullscreenTriggerRef}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            chatRefreshTrigger={chatRefreshTrigger}
            onCollapse={() => setIsChatExpanded(false)}
          />
        </div>
      </div>
    </div>
  )
}
