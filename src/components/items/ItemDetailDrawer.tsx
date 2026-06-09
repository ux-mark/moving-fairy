'use client'

import { useCallback, useEffect, useState } from 'react'
import { Camera, Check, MessageCircle, RotateCcw } from 'lucide-react'
import { Button, Spinner } from '@thefairies/design-system/components'

import { Drawer } from '@/components/layout/Drawer'
import { ItemEditPanel } from '@/components/decisions/ItemEditPanel'
import { FloatingChatPanel } from '@/components/decisions/FloatingChatPanel'
import { VerdictPicker } from '@/components/decisions/VerdictPicker'
import { COUNTRY_CURRENCY, ProcessingStatus, Verdict } from '@/lib/constants'
import { proxyImageUrl } from '@/lib/storage-url'
import type { ItemAssessment } from '@/types'

import styles from './ItemDetailDrawer.module.css'

interface ItemDetailDrawerProps {
  item: ItemAssessment
  onClose: () => void
  onItemUpdate?: (updated: ItemAssessment) => void
  onRetry: (itemId: string) => Promise<void>
}

const VERDICT_LABELS: Record<string, string> = {
  SHIP:    'Ship',
  CARRY:   'Carry',
  SELL:    'Sell',
  DONATE:  'Donate',
  DISCARD: 'Discard',
  REVISIT: 'Decide later',
}

const VERDICT_BG: Record<string, string> = {
  SHIP:    'var(--verdict-ship-bg, #dcfce7)',
  CARRY:   'var(--verdict-carry-bg, #dbeafe)',
  SELL:    'var(--verdict-sell-bg, #fef3c7)',
  DONATE:  'var(--verdict-donate-bg, #f3f4f6)',
  DISCARD: 'var(--verdict-discard-bg, #f3f4f6)',
  REVISIT: 'var(--verdict-decide-later-bg, #dbeafe)',
}

const VERDICT_FG: Record<string, string> = {
  SHIP:    'var(--verdict-ship-fg, #166534)',
  CARRY:   'var(--verdict-carry-fg, #1e40af)',
  SELL:    'var(--verdict-sell-fg, #92400e)',
  DONATE:  'var(--verdict-donate-fg, #374151)',
  DISCARD: 'var(--verdict-discard-fg, #374151)',
  REVISIT: 'var(--verdict-decide-later-fg, #1e40af)',
}

/**
 * Right-side detail panel for an item. Renders when the list sets
 * `?item=<id>`. Built around one task: decide. The verdict header strip
 * leads — Confirm / Change verdict are the first things the user sees.
 * Edit details follow. Chat is a single button at the bottom that links
 * to the full /decisions/[id] route so the conversation doesn't compete
 * with the editor for scroll real estate.
 */
export function ItemDetailDrawer({
  item: initialItem,
  onClose,
  onItemUpdate,
  onRetry,
}: ItemDetailDrawerProps) {
  const [item, setItem] = useState<ItemAssessment>(initialItem)
  const [imageError, setImageError] = useState(false)
  const [verdictPickerOpen, setVerdictPickerOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  // Floating chat panel — opens beside the drawer, drag/resize. Persists
  // open state in localStorage so it survives navigation and refreshes.
  const [chatOpen, setChatOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('mf:chat.open') === 'true'
  })
  // Bump on every successful save so the chat re-fetches history (Aisling
  // may have re-assessed after a verdict change).
  const [chatRefreshTrigger, setChatRefreshTrigger] = useState(0)

  useEffect(() => {
    setItem(initialItem)
    setImageError(false)
  }, [initialItem])

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

  const [boxes, setBoxes] = useState<Array<{ id: string; label: string; status: string; items: Array<{ item_assessment_id: string | null }> }>>([])
  const [shipments, setShipments] = useState<Array<{ id: string; label: string }>>([])

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
    // Give the chat a beat to know it should re-fetch — Aisling may have
    // amended her reasoning after a verdict / cost change.
    setTimeout(() => setChatRefreshTrigger((n) => n + 1), 300)
  }, [item.id, onItemUpdate])

  const handleAssessmentUpdated = useCallback((updated: ItemAssessment) => {
    setItem(updated)
    onItemUpdate?.(updated)
  }, [onItemUpdate])

  const handleDeleted = useCallback(() => onClose(), [onClose])

  const handleConfirm = useCallback(async () => {
    if (confirming) return
    setConfirming(true)
    try {
      await handleSave({ user_confirmed: true })
    } finally {
      setConfirming(false)
    }
  }, [confirming, handleSave])

  const handleVerdictChange = useCallback(
    async (verdict: string) => {
      setVerdictPickerOpen(false)
      // Changing the verdict resets user_confirmed — Aisling re-proposed,
      // user hasn't accepted the new value yet.
      await handleSave({ verdict, user_confirmed: false } as Partial<ItemAssessment>)
    },
    [handleSave],
  )

  const isCompleted = item.processing_status === ProcessingStatus.COMPLETED
  const isPending = item.processing_status === ProcessingStatus.PENDING
  const isProcessing = item.processing_status === ProcessingStatus.PROCESSING
  const isFailed = item.processing_status === ProcessingStatus.FAILED

  const itemName = item.item_name || 'Item'
  const thumbnail = item.image_url ? proxyImageUrl(item.image_url) : undefined

  const currentBoxId = boxes.find(box =>
    box.items?.some(bi => bi.item_assessment_id === item.id)
  )?.id ?? ''
  const availableBoxes = boxes.filter(b => b.status === 'packing')

  const verdict = item.verdict
  const verdictLabel = verdict ? VERDICT_LABELS[verdict] ?? verdict : null
  const verdictBg = verdict ? VERDICT_BG[verdict] : undefined
  const verdictFg = verdict ? VERDICT_FG[verdict] : undefined

  // Confidence on the verdict card. Items without verdicts won't render the strip.
  const confidence = typeof item.confidence === 'number' ? Math.round(item.confidence) : null

  // Persist chat-open state so it survives item switches and refreshes.
  const handleToggleChat = useCallback(() => {
    setChatOpen((prev) => {
      const next = !prev
      try { window.localStorage.setItem('mf:chat.open', String(next)) } catch {}
      return next
    })
  }, [])

  const handleCloseChat = useCallback(() => {
    setChatOpen(false)
    try { window.localStorage.setItem('mf:chat.open', 'false') } catch {}
  }, [])

  return (
    <>
    <Drawer
      title={itemName}
      onClose={onClose}
      size="lg"
      ariaLabel={`Details for ${itemName}`}
      headerActions={
        <button
          type="button"
          className={styles.chatToggle}
          onClick={handleToggleChat}
          disabled={!isCompleted}
          aria-pressed={chatOpen}
          title={
            !isCompleted
              ? 'Chat opens once Aisling finishes the assessment'
              : chatOpen
                ? 'Close chat'
                : 'Chat with Aisling about this item'
          }
        >
          <MessageCircle size={16} aria-hidden="true" />
          <span>{chatOpen ? 'Hide chat' : 'Chat with Aisling'}</span>
        </button>
      }
    >
      {/* Single content body — chat lives in a separate floating panel
          (rendered as a sibling below) so the user can see details and
          chat at the same time, move the chat, resize it. */}
      <div className={styles.scroll}>
        {/* Photo — identification, not hero. */}
        {thumbnail ? (
          imageError ? (
            <div className={styles.imageError} role="status">
              <Camera size={28} aria-hidden="true" />
              <p className={styles.imageErrorText}>Photo could not be loaded</p>
            </div>
          ) : (
            // Plain <img> — we don't know the natural dimensions ahead of
            // time, and we want the browser to size to the actual aspect
            // (contain inside max-height) so portrait phone shots fit
            // edge-to-edge without dead white space. next/image would
            // require fixed width/height which fights this.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnail}
              alt={itemName}
              className={styles.image}
              onError={() => setImageError(true)}
            />
          )
        ) : isCompleted ? (
          <div className={styles.noImage}>
            <Camera size={24} aria-hidden="true" />
            <p className={styles.noImageText}>No photo for this item</p>
          </div>
        ) : null}

        {/* Verdict header strip — the headline of this drawer. */}
        {isCompleted && (
          <section className={styles.verdictStrip} aria-label="Aisling's recommendation">
            {verdict ? (
              <>
                <div className={styles.verdictLeft}>
                  <span
                    className={styles.verdictPill}
                    style={{ background: verdictBg, color: verdictFg }}
                  >
                    {verdictLabel}
                  </span>
                  {confidence !== null && (
                    <span className={styles.confidence}>
                      {confidence}% confidence
                    </span>
                  )}
                </div>
                <div className={styles.verdictActions}>
                  {item.user_confirmed ? (
                    <span className={styles.confirmedPill}>
                      <Check size={14} aria-hidden="true" />
                      Confirmed
                    </span>
                  ) : verdict === Verdict.REVISIT ? (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => setVerdictPickerOpen(true)}
                    >
                      Decide now
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleConfirm}
                      disabled={confirming}
                    >
                      <Check size={16} aria-hidden="true" />
                      {confirming ? 'Confirming…' : 'Confirm'}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => setVerdictPickerOpen(true)}
                  >
                    Change verdict
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.verdictLeft}>
                  <span className={styles.noVerdictText}>
                    No recommendation yet
                  </span>
                </div>
                <div className={styles.verdictActions}>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => setVerdictPickerOpen(true)}
                  >
                    Set verdict
                  </Button>
                </div>
              </>
            )}
          </section>
        )}

        {item.needs_clarification && (
          <div className={styles.clarification} role="note">
            <div className={styles.clarificationText}>
              <p className={styles.clarificationTitle}>Aisling needs more information</p>
              <p className={styles.clarificationBody}>
                Open the chat to help her finish this assessment.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (!chatOpen) handleToggleChat()
              }}
            >
              Open chat
            </Button>
          </div>
        )}

        {(isPending || isProcessing) && (
          <div className={styles.processingState} aria-busy="true">
            <Spinner size="md" />
            <p className={styles.processingTitle}>
              {isPending ? 'Waiting for Aisling…' : 'Aisling is looking at this one…'}
            </p>
            <p className={styles.processingText}>
              {isPending
                ? 'Queued for assessment — usually just a moment.'
                : 'The verdict will appear here when ready.'}
            </p>
          </div>
        )}

        {isFailed && (
          <div className={styles.processingState} role="alert">
            <p className={styles.processingTitle}>Assessment failed</p>
            <p className={styles.processingText}>
              Try the assessment again, or open the full page to delete.
            </p>
            <Button
              variant="secondary"
              size="md"
              onClick={() => onRetry(item.id)}
            >
              <RotateCcw size={16} aria-hidden="true" />
              Retry assessment
            </Button>
          </div>
        )}

        {/* Edit panel: name, costs, box, shipment, category, plant care,
            save, danger. Verdict is no longer here — the header strip owns
            it. ItemEditPanel itself was restructured to drop the verdict
            select and reorder fields by frequency of use. */}
        {isCompleted && (
          <ItemEditPanel
            key={item.updated_at}
            item={item}
            shipCurrency={shipCurrency}
            replaceCurrency={replaceCurrency}
            onSave={handleSave}
            onDeleted={handleDeleted}
            availableBoxes={availableBoxes}
            currentBoxId={currentBoxId}
            availableShipments={shipments}
          />
        )}

      </div>

      {/* Verdict picker — bottom sheet on mobile, popover on desktop.
          Rendered at drawer body level so it overlays correctly. */}
      {verdictPickerOpen && (
        <VerdictPicker
          currentVerdict={verdict ?? null}
          isOpen={true}
          onClose={() => setVerdictPickerOpen(false)}
          onVerdictChange={handleVerdictChange}
          {...(item.item_name ? { itemName: item.item_name } : {})}
        />
      )}
    </Drawer>

    {/* Floating, draggable chat panel — separate surface from the drawer
        so the user can see details AND chat at the same time, move the
        chat where they want it, and keep it open across item switches.
        Mobile renders as a full-screen slide-up sheet inside the panel
        component (drag/resize don't apply on phones). */}
    {chatOpen && isCompleted && (
      <FloatingChatPanel
        itemId={item.id}
        itemName={itemName}
        {...(thumbnail ? { thumbnailUrl: thumbnail } : {})}
        onClose={handleCloseChat}
        chatRefreshTrigger={chatRefreshTrigger}
        onAssessmentUpdated={handleAssessmentUpdated}
      />
    )}
    </>
  )
}
