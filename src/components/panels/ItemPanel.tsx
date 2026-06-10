'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Check, MessageCircle, RotateCcw } from 'lucide-react'
import { Button, ConfirmDialog, Spinner } from '@thefairies/design-system/components'

import { ItemEditPanel } from '@/components/decisions/ItemEditPanel'
import { VerdictPicker } from '@/components/decisions/VerdictPicker'
import { useItems } from '@/lib/hooks/useItems'
import { useBoxes } from '@/lib/hooks/useBoxes'
import { useShipments } from '@/lib/hooks/useShipments'
import { COUNTRY_CURRENCY, ProcessingStatus, Verdict } from '@/lib/constants'
import { proxyImageUrl } from '@/lib/storage-url'
import type { ItemAssessment } from '@/types'

import { emitChatRefresh } from './chatRefreshBus'
import { panelId } from './panelsReducer'
import { usePanels } from './PanelProvider'
import type { PanelContentProps } from './registry'
import styles from './ItemPanel.module.css'

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
 * Item detail panel (spec §3). Verdict header strip leads, then photo and the
 * edit form. Item data comes from the live items hook, so background
 * reassessments and edits from other devices flow in without reopening.
 * "Chat with Aisling" opens an independent chat sub-panel docked opposite.
 */
export function ItemPanel({ panelId: id, entityId }: PanelContentProps) {
  const { panels, openPanel, closePanel, setPanelTitle } = usePanels()
  const { items, isLoading, refresh, retryAssessment } = useItems()
  const item = items.find((i) => i.id === entityId)

  const [imageError, setImageError] = useState(false)
  const [verdictPickerOpen, setVerdictPickerOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const itemName = item?.item_name || 'Item'
  useEffect(() => {
    setPanelTitle(id, itemName)
  }, [id, itemName, setPanelTitle])

  useEffect(() => {
    setImageError(false)
  }, [item?.image_url])

  // Currencies persisted on the item win; fall back to the profile's
  // departure/arrival countries (same derivation the old drawer used).
  const [shipCurrency, setShipCurrency] = useState<string>(item?.currency ?? 'USD')
  const [replaceCurrency, setReplaceCurrency] = useState<string>(item?.replace_currency ?? 'EUR')

  useEffect(() => {
    if (item?.currency && item.replace_currency) return
    fetch('/api/profile')
      .then(res => res.ok ? res.json() : null)
      .then((data: { ok?: boolean; profile?: { departure_country?: string; arrival_country?: string } } | null) => {
        if (data?.ok && data.profile) {
          const dep = data.profile.departure_country
          const arr = data.profile.arrival_country
          if (!item?.currency && dep) setShipCurrency(COUNTRY_CURRENCY[dep] ?? 'USD')
          if (!item?.replace_currency && arr) setReplaceCurrency(COUNTRY_CURRENCY[arr] ?? 'EUR')
        }
      })
      .catch(() => {})
  }, [item?.currency, item?.replace_currency])

  // Live boxes + shipments — box membership and shipment legs stay current
  // while the panel is open.
  const { rows: boxes } = useBoxes()
  const { rows: shipments } = useShipments()

  const handleSave = useCallback(async (updates: Partial<ItemAssessment>) => {
    const res = await fetch(`/api/items/${entityId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) {
      const data = await res.json() as { error?: string }
      throw new Error(data.error ?? 'Failed to save changes')
    }
    // Realtime delivers the update too; refresh makes it deterministic.
    await refresh()
    // Give the chat sub-panel a beat to re-fetch — a save injects a system
    // message and Aisling may amend her reasoning.
    setTimeout(() => emitChatRefresh(entityId), 300)
  }, [entityId, refresh])

  const handleDeleted = useCallback(() => {
    closePanel(panelId('chat', entityId))
    closePanel(id)
  }, [closePanel, entityId, id])

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

  const openChat = useCallback(() => {
    const side = panels.find((p) => p.id === id)?.side
    openPanel({
      kind: 'chat',
      entityId,
      title: `Chat — ${itemName}`,
      // Passing this panel's own side docks the chat on the opposite side.
      ...(side ? { originSide: side } : {}),
    })
  }, [panels, id, openPanel, entityId, itemName])

  // Delete for items the edit form can't host (pending/processing/failed).
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement>(null)

  const handleDelete = useCallback(async () => {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/items/${entityId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? 'Failed to delete item')
      }
      setConfirmDeleteOpen(false)
      await refresh()
      handleDeleted()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete item. Please try again.')
      setIsDeleting(false)
    }
  }, [entityId, refresh, handleDeleted])

  if (!item) {
    return (
      <div className={styles.scroll}>
        {isLoading ? (
          <div className={styles.processingState} aria-busy="true">
            <Spinner size="md" />
            <p className={styles.processingText}>Loading item…</p>
          </div>
        ) : (
          <div className={styles.processingState} role="status">
            <p className={styles.processingTitle}>Item not found</p>
            <p className={styles.processingText}>
              This item may have been deleted, or you don&apos;t have access to it.
            </p>
          </div>
        )}
      </div>
    )
  }

  const isCompleted = item.processing_status === ProcessingStatus.COMPLETED
  const isPending = item.processing_status === ProcessingStatus.PENDING
  const isProcessing = item.processing_status === ProcessingStatus.PROCESSING
  const isFailed = item.processing_status === ProcessingStatus.FAILED

  const thumbnail = item.image_url ? proxyImageUrl(item.image_url) : undefined

  const currentBoxId = boxes.find(box =>
    box.items?.some(bi => bi.item_assessment_id === item.id)
  )?.id ?? ''
  const availableBoxes = boxes
    .filter(b => b.status === 'packing')
    .map(b => ({ id: b.id, label: b.label }))
  const availableShipments = shipments.map(s => ({ id: s.id, label: s.label }))

  const verdict = item.verdict
  const verdictLabel = verdict ? VERDICT_LABELS[verdict] ?? verdict : null
  const verdictBg = verdict ? VERDICT_BG[verdict] : undefined
  const verdictFg = verdict ? VERDICT_FG[verdict] : undefined
  const confidence = typeof item.confidence === 'number' ? Math.round(item.confidence) : null

  return (
    <div className={styles.scroll}>
      {/* Photo — identification, not hero. */}
      {thumbnail ? (
        imageError ? (
          <div className={styles.imageError} role="status">
            <Camera size={28} aria-hidden="true" />
            <p className={styles.imageErrorText}>Photo could not be loaded</p>
          </div>
        ) : (
          // Plain <img> — natural dimensions are unknown and the photo sizes
          // to its actual aspect (contain inside max-height); next/image
          // would require fixed width/height which fights this.
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

      {/* Verdict header strip — the headline of this panel. */}
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

      {/* Chat affordance — opens the independent chat sub-panel. */}
      {isCompleted && (
        <button
          type="button"
          className={styles.chatButton}
          onClick={openChat}
        >
          <MessageCircle size={16} aria-hidden="true" />
          <span>Chat with Aisling</span>
        </button>
      )}

      {item.needs_clarification && (
        <div className={styles.clarification} role="note">
          <div className={styles.clarificationText}>
            <p className={styles.clarificationTitle}>Aisling needs more information</p>
            <p className={styles.clarificationBody}>
              Open the chat to help her finish this assessment.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={openChat}>
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
            Try the assessment again, or delete the item.
          </p>
          {deleteError && (
            <p className={styles.deleteError} role="alert">{deleteError}</p>
          )}
          <div className={styles.failedActions}>
            <Button
              ref={deleteTriggerRef}
              variant="ghost"
              size="md"
              onClick={() => {
                setDeleteError(null)
                setConfirmDeleteOpen(true)
              }}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => void retryAssessment(item.id).catch(console.error)}
            >
              <RotateCcw size={16} aria-hidden="true" />
              Retry assessment
            </Button>
          </div>
        </div>
      )}

      {/* Edit panel: name, costs, box, shipment, category, plant care, save,
          delete (with its own destructive confirm). Keyed by updated_at so a
          background update re-seeds the form. */}
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
          availableShipments={availableShipments}
        />
      )}

      {verdictPickerOpen && (
        <VerdictPicker
          currentVerdict={verdict ?? null}
          isOpen={true}
          onClose={() => setVerdictPickerOpen(false)}
          onVerdictChange={handleVerdictChange}
          {...(item.item_name ? { itemName: item.item_name } : {})}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => {
          if (!isDeleting) setConfirmDeleteOpen(false)
        }}
        title={`Delete "${itemName}"?`}
        description="This removes the photo, any chat history, and stops the assessment if it's still queued. This can't be undone."
        confirmLabel="Delete item"
        cancelLabel="Keep item"
        onConfirm={handleDelete}
        isConfirming={isDeleting}
        variant="danger"
        triggerRef={deleteTriggerRef}
      />
    </div>
  )
}
