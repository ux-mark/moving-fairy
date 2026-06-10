'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Camera, Sparkles, ChevronUp } from 'lucide-react'
import { Button, ConfirmDialog, Spinner } from '@thefairies/design-system/components'
import type { ItemAssessment } from '@/types'
import { COUNTRY_CURRENCY } from '@/lib/constants'
import { proxyImageUrl } from '@/lib/storage-url'
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

// _onConfirm is kept for interface compatibility; the confirm flow will be
// re-added in a follow-up. The `_` prefix marks it intentionally unused.
export function ItemDetailView({ item: initialItem, onConfirm: _onConfirm, onRetry, onItemUpdate }: ItemDetailViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const backHref = from === 'boxes' ? '/boxes' : '/decisions'
  const backLabel = from === 'boxes' ? 'Back to boxes' : 'Back to decisions'

  const [item, setItem] = useState<ItemAssessment>(initialItem)
  const [imageError, setImageError] = useState(false)

  // Reset image error state when the image URL changes (e.g. after a poll delivers the URL)
  useEffect(() => {
    setImageError(false)
  }, [item.image_url])

  // ---------------------------------------------------------------------------
  // Box data for assignment selector
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // User profile for currency derivation
  // ---------------------------------------------------------------------------

  // Prefer currencies persisted on the item itself — they're set at assessment
  // time and won't flicker. Only fall back to fetching the profile when one is
  // missing (e.g. lightweight items that skip currency capture).
  const [shipCurrency, setShipCurrency] = useState<string>(item.currency ?? 'USD')
  const [replaceCurrency, setReplaceCurrency] = useState<string>(item.replace_currency ?? 'EUR')

  useEffect(() => {
    if (item.currency && item.replace_currency) return
    fetch('/api/profile')
      .then(res => res.ok ? res.json() : null)
      .then((data: { ok?: boolean; profile?: { departure_country?: string; arrival_country?: string } } | null) => {
        if (data?.ok && data.profile) {
          const dep = data.profile.departure_country
          const arr = data.profile.arrival_country
          if (!item.currency && dep) setShipCurrency(COUNTRY_CURRENCY[dep] ?? 'USD')
          if (!item.replace_currency && arr) setReplaceCurrency(COUNTRY_CURRENCY[arr] ?? 'EUR')
        }
      })
      .catch(() => {})
  }, [item.currency, item.replace_currency])

  const [boxes, setBoxes] = useState<Array<{id: string, label: string, status: string, items: Array<{item_assessment_id: string | null}>}>>([])
  const [shipments, setShipments] = useState<Array<{id: string, label: string}>>([])

  useEffect(() => {
    fetch('/api/boxes')
      .then(res => res.ok ? res.json() : [])
      .then(data => setBoxes(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/shipments')
      .then(res => res.ok ? res.json() : [])
      .then(data => setShipments(Array.isArray(data) ? data : []))
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
  // Route through the /api/img proxy so the image loads on any device
  // on the LAN (same approach as ItemCard in the list view).
  const thumbnail = item.image_url ? proxyImageUrl(item.image_url) : undefined


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

  const handleDeleted = useCallback(() => {
    router.push(backHref)
  }, [router, backHref])

  // ---------------------------------------------------------------------------
  // Pre-completion delete (cancel queued / processing / failed items).
  // Mirrors the post-completion delete in ItemEditPanel but lives here because
  // the edit panel isn't rendered until processing_status === 'completed'.
  // ---------------------------------------------------------------------------

  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const cancelDeleteButtonRef = useRef<HTMLButtonElement>(null)

  const handleConfirmDelete = useCallback(async () => {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/items/${item.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? 'Failed to delete item')
      }
      setConfirmDeleteOpen(false)
      handleDeleted()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete item. Please try again.')
      setIsDeleting(false)
    }
  }, [item.id, handleDeleted])

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

  // Hide item content on MOBILE during fullscreen or expanded chat; on desktop
  // (≥1024px) the split layout always shows both columns regardless of state,
  // so CSS keeps the content visible via the .itemContentDesktopVisible class.
  const itemContentHidden = isFullscreen || isChatExpanded

  return (
    <div className={isFullscreen ? styles.fullscreenLayout : styles.root}>
      {/* Item content — single render path. Mobile hides via styles.itemContentHidden
          when fullscreen/expanded; desktop CSS overrides that to keep it visible. */}
      {(
        <div className={
          itemContentHidden
            ? `${styles.itemContent} ${styles.itemContentHidden}`
            : styles.itemContent
        }>
          <nav aria-label="Breadcrumb">
            <Link href={backHref} className={styles.backLink}>
              <ArrowLeft size={16} aria-hidden="true" />
              {backLabel}
            </Link>
          </nav>

          {thumbnail ? (
            imageError ? (
              <div className={styles.imageErrorPlaceholder} role="status">
                <Camera size={32} aria-hidden="true" className={styles.imageErrorIcon} />
                <p className={styles.imageErrorText}>Photo could not be loaded</p>
              </div>
            ) : (
              // Plain <img> — natural file dimensions drive layout. The
              // CSS sizes the figure to the image's actual aspect (contain
              // inside a capped envelope) so portrait phone shots don't
              // float in fat white margins.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnail}
                alt={itemName}
                className={styles.itemImg}
                onError={() => setImageError(true)}
              />
            )
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
                {deleteError && (
                  <p className={styles.processingText} role="alert">{deleteError}</p>
                )}
                <Button
                  ref={cancelDeleteButtonRef}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDeleteError(null)
                    setConfirmDeleteOpen(true)
                  }}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Cancel and delete this item'}
                </Button>
              </div>
            )}

            {isFailed && (
              <div className={styles.processingState} role="alert">
                <p className={styles.processingTitle}>Assessment failed</p>
                <p className={styles.processingText}>
                  Something went wrong assessing this item. Tap below to try again.
                </p>
                {deleteError && (
                  <p className={styles.processingText} role="alert">{deleteError}</p>
                )}
                <Button variant="secondary" size="sm" onClick={() => onRetry(item.id)} disabled={isDeleting}>
                  Retry assessment
                </Button>
                <Button
                  ref={cancelDeleteButtonRef}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDeleteError(null)
                    setConfirmDeleteOpen(true)
                  }}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete this item'}
                </Button>
              </div>
            )}

            {isCompleted && (
              <ItemEditPanel
                key={item.updated_at}
                item={item}
                shipCurrency={shipCurrency}
                replaceCurrency={replaceCurrency}
                onSave={handleSave}
                onDeleted={handleDeleted}
                onNavigateBack={handleNavigateBack}
                backLabel={backLabel}
                availableBoxes={availableBoxes}
                currentBoxId={currentBoxId}
                availableShipments={shipments}
              />
            )}
          </div>

          {/* Shared delete confirmation for pre-completion states. The
              completed state has its own dialog inside ItemEditPanel. */}
          {(isPending || isProcessing || isFailed) && (
            <ConfirmDialog
              isOpen={confirmDeleteOpen}
              onClose={() => {
                if (!isDeleting) setConfirmDeleteOpen(false)
              }}
              title={`Delete "${itemName}"?`}
              description="This removes the photo, any chat history, and stops the assessment if it's still queued. This can't be undone."
              confirmLabel="Delete item"
              cancelLabel="Keep item"
              onConfirm={handleConfirmDelete}
              isConfirming={isDeleting}
              variant="danger"
              triggerRef={cancelDeleteButtonRef}
            />
          )}
        </div>
      )}

      {/* Per-item chat — SINGLE instance, never unmounts on fullscreen/sheet toggle.
          On desktop the .chatColumnDesktop class promotes it to a persistent right column. */}
      <div className={
        (isFullscreen
          ? styles.chatSectionFullscreen
          : isChatExpanded
            ? styles.chatSheetExpanded
            : styles.chatSheet) + ' ' + styles.chatColumnDesktop
      }>
        {/* Collapsed bar — mobile-only affordance, hidden on desktop via CSS. */}
        {!isFullscreen && !isChatExpanded && (
          <button
            type="button"
            className={`${styles.chatBar} ${styles.chatBarMobileOnly}`}
            onClick={() => setIsChatExpanded(true)}
            aria-label="Open chat with Aisling"
          >
            <Sparkles size={18} aria-hidden="true" className={styles.chatBarIcon} />
            <span className={styles.chatBarText}>Chat with Aisling</span>
            <ChevronUp size={16} aria-hidden="true" />
          </button>
        )}

        {/* Chat body — hidden on mobile when collapsed; CSS reveals it on desktop. */}
        <div className={
          (!isFullscreen && !isChatExpanded
            ? styles.chatBodyHidden
            : styles.chatBody) + ' ' + styles.chatBodyDesktopVisible
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
            backHref={backHref}
            backLabel={backLabel}
          />
        </div>
      </div>
    </div>
  )
}
