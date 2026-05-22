'use client'

import { useState, useCallback, useEffect, useId, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Button, ConfirmDialog } from '@thefairies/design-system/components'
import type { ItemAssessment, PlantCare } from '@/types'
import type { Verdict } from '@/lib/constants'
import { CategoryPicker } from '@/components/shared/CategoryPicker'
import { PlantCareEditor } from '@/components/shared/PlantCareEditor'
import styles from './ItemEditPanel.module.css'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VERDICT_OPTIONS: { value: Verdict; label: string }[] = [
  { value: 'SHIP', label: 'Ship' },
  { value: 'CARRY', label: 'Carry' },
  { value: 'SELL', label: 'Sell' },
  { value: 'DONATE', label: 'Donate' },
  { value: 'DISCARD', label: 'Discard' },
  { value: 'REVISIT', label: 'Decide later' },
]

const CURRENCY_CONTEXT: Record<string, string> = {
  USD: 'from the US',
  EUR: 'in Ireland',
  AUD: 'in Australia',
  GBP: 'in the UK',
  CAD: 'in Canada',
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ItemEditPanelProps {
  item: ItemAssessment
  shipCurrency?: string
  replaceCurrency?: string
  onSave: (updates: Partial<ItemAssessment>) => Promise<void>
  onDeleted?: () => void
  onNavigateBack?: () => void
  onNavigateNext?: () => void
  hasNextItem?: boolean
  availableBoxes?: Array<{id: string, label: string}>
  currentBoxId?: string
  /**
   * Shipments the owner can route this item to. Pass an empty array (or
   * a single-shipment array) to hide the selector — single-leg moves
   * don't need it.
   */
  availableShipments?: Array<{id: string, label: string}>
  backLabel?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// Currency symbol lookup
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$',
}
function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code
}

export function ItemEditPanel({ item, shipCurrency = 'USD', replaceCurrency = 'EUR', onSave, onDeleted, onNavigateBack, onNavigateNext, hasNextItem, availableBoxes, currentBoxId, availableShipments, backLabel = 'Back to decisions' }: ItemEditPanelProps) {
  const id = useId()
  const prefersReducedMotion = useReducedMotion()
  const deleteButtonRef = useRef<HTMLButtonElement>(null)

  const [name, setName] = useState(item.item_name || '')
  const [verdict, setVerdict] = useState<string>(item.verdict || '')
  const [shipCost, setShipCost] = useState(item.estimated_ship_cost?.toString() ?? '')
  const [replaceCost, setReplaceCost] = useState(item.estimated_replace_cost?.toString() ?? '')
  const [description, setDescription] = useState(item.advice_text || '')
  const [boxId, setBoxId] = useState(currentBoxId ?? '')
  // Empty string means "no override / fall back to default leg" — matches
  // the SQL semantics of `target_shipment_id IS NULL`.
  const [targetShipmentId, setTargetShipmentId] = useState(item.target_shipment_id ?? '')
  const [category, setCategory] = useState<string | null>(item.category ?? null)
  const [care, setCare] = useState<PlantCare | null>(item.care ?? null)
  // Seller's master list — fetched lazily on mount so the panel still
  // renders instantly with the existing fields. Empty until the fetch
  // resolves; CategoryPicker handles that shape safely.
  const [categories, setCategories] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        const list = (data as { categories?: unknown }).categories
        if (Array.isArray(list) && list.every((c) => typeof c === 'string')) {
          setCategories(list as string[])
        }
      })
      .catch(() => {
        // Non-fatal — picker still offers "No category" + "Add new…".
      })
    return () => {
      cancelled = true
    }
  }, [])
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [showNavCtas, setShowNavCtas] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  // Care is compared via JSON identity. PlantCareEditor normalises the value
  // to a canonical shape (empty fields stripped, or null when fully cleared),
  // so a string-equal compare here is stable and won't false-positive.
  const careChanged = JSON.stringify(care) !== JSON.stringify(item.care ?? null)

  const hasChanges =
    name !== (item.item_name || '') ||
    verdict !== (item.verdict || '') ||
    shipCost !== (item.estimated_ship_cost?.toString() ?? '') ||
    replaceCost !== (item.estimated_replace_cost?.toString() ?? '') ||
    description !== (item.advice_text || '') ||
    boxId !== (currentBoxId ?? '') ||
    targetShipmentId !== (item.target_shipment_id ?? '') ||
    category !== (item.category ?? null) ||
    careChanged

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    setShowNavCtas(false)
    try {
      await onSave({
        item_name: name,
        verdict: verdict ? (verdict as Verdict) : null,
        estimated_ship_cost: shipCost ? parseFloat(shipCost) : null,
        estimated_replace_cost: replaceCost ? parseFloat(replaceCost) : null,
        advice_text: description,
        target_shipment_id: targetShipmentId === '' ? null : targetShipmentId,
        category,
        // Only include `care` when it has actually changed — leaves the
        // backend free to skip the column entirely for non-plant edits.
        ...(careChanged ? { care } : {}),
      })

      // Handle box assignment separately — only when verdict is SHIP or CARRY
      // and the box selection has changed
      if (boxId !== (currentBoxId ?? '') && boxId && (verdict === 'SHIP' || verdict === 'CARRY')) {
        try {
          const boxRes = await fetch(`/api/boxes/${boxId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_assessment_id: item.id }),
          })
          if (!boxRes.ok) {
            setSaveError('Changes saved, but box assignment failed. Try again from the boxes page.')
            setIsSaving(false)
            return
          }
        } catch {
          setSaveError('Changes saved, but box assignment failed. Try again from the boxes page.')
          setIsSaving(false)
          return
        }
      }

      setSaveSuccess(true)
      if (onNavigateBack) {
        setShowNavCtas(true)
      } else {
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } catch {
      setSaveError('Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }, [name, verdict, shipCost, replaceCost, description, boxId, currentBoxId, targetShipmentId, category, care, careChanged, item.id, onSave, onNavigateBack])

  const handleDelete = useCallback(async () => {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/items/${item.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? 'Failed to delete item')
      }
      setConfirmDeleteOpen(false)
      onDeleted?.()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete item. Please try again.')
      setIsDeleting(false)
    }
  }, [item.id, onDeleted])

  // Allow external reset when item data updates (e.g. after Aisling reassesses)
  // We deliberately don't include a deep equality check — the parent calls
  // updateItem which replaces the whole item object reference, so new data is
  // always picked up on the next render naturally via useState initial values.
  // Instead we expose an imperative reset so the parent can call it after a
  // reassessment event.

  return (
    <section className={styles.root} aria-label="Edit item details">
      <h2 className={styles.sectionTitle}>Item details</h2>

      {/* Item name */}
      <div className={styles.field}>
        <label htmlFor={`${id}-name`} className={styles.label}>
          Item name
        </label>
        <input
          id={`${id}-name`}
          type="text"
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What is this item?"
          disabled={isSaving}
          autoComplete="off"
        />
      </div>

      {/* Verdict */}
      <div className={styles.field}>
        <label htmlFor={`${id}-verdict`} className={styles.label}>
          Aisling&apos;s recommendation
        </label>
        <select
          id={`${id}-verdict`}
          className={styles.select}
          value={verdict}
          onChange={(e) => setVerdict(e.target.value)}
          disabled={isSaving}
        >
          <option value="">No recommendation yet</option>
          {VERDICT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Category — owner-defined master list lives in seller_settings.
          Always shown (independent of verdict): an item can have a category
          regardless of whether it's a SHIP/CARRY/SELL outcome. */}
      <div className={styles.field}>
        <label htmlFor={`${id}-category`} className={styles.label}>
          Category
        </label>
        <CategoryPicker
          selectId={`${id}-category`}
          value={category}
          categories={categories}
          onChange={setCategory}
          onCategoriesUpdated={setCategories}
          selectClassName={styles.select}
          inputClassName={styles.input}
          disabled={isSaving}
        />
      </div>

      {/* Plant care — visible only when this item is a plant, either by
          live category selection or by Aisling's biosec classification.
          Reacts to the local category state so flipping to "Plants" reveals
          the editor without waiting on a save round-trip. */}
      {(category === 'Plants' ||
        item.biosecurity_category === 'plant_matter') && (
        <PlantCareEditor
          value={care}
          onChange={setCare}
          disabled={isSaving}
          inputClassName={styles.input}
          selectClassName={styles.select}
          textareaClassName={styles.textarea}
        />
      )}

      {/* Box assignment — only for SHIP or CARRY verdicts */}
      {(verdict === 'SHIP' || verdict === 'CARRY') && availableBoxes && availableBoxes.length > 0 && (
        <div className={styles.field}>
          <label htmlFor={`${id}-box`} className={styles.label}>
            Assign to a box
          </label>
          <select
            id={`${id}-box`}
            className={styles.select}
            value={boxId}
            onChange={(e) => setBoxId(e.target.value)}
            disabled={isSaving}
          >
            <option value="">Not assigned to a box</option>
            {availableBoxes.map((box) => (
              <option key={box.id} value={box.id}>{box.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Shipment leg — only render when the move has more than one leg.
          Null target = "use the default leg" (matches DB semantics). */}
      {(verdict === 'SHIP' || verdict === 'CARRY') && availableShipments && availableShipments.length > 1 && (
        <div className={styles.field}>
          <label htmlFor={`${id}-shipment`} className={styles.label}>
            Shipment leg
          </label>
          <select
            id={`${id}-shipment`}
            className={styles.select}
            value={targetShipmentId}
            onChange={(e) => setTargetShipmentId(e.target.value)}
            disabled={isSaving}
          >
            <option value="">Default leg</option>
            {availableShipments.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Costs */}
      <div className={styles.costsRow}>
        <div className={styles.field}>
          <label htmlFor={`${id}-ship-cost`} className={styles.label}>
            Shipping cost {CURRENCY_CONTEXT[shipCurrency] ? `(${CURRENCY_CONTEXT[shipCurrency]})` : `(${shipCurrency})`}
          </label>
          <div className={styles.inputWithPrefix}>
            <span className={styles.currencyPrefix} aria-hidden="true">{currencySymbol(shipCurrency)}</span>
            <input
              id={`${id}-ship-cost`}
              type="number"
              inputMode="decimal"
              className={styles.inputPrefixed}
              value={shipCost}
              onChange={(e) => setShipCost(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              disabled={isSaving}
              aria-label={`Estimated shipping cost in ${shipCurrency}`}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor={`${id}-replace-cost`} className={styles.label}>
            Replacement cost {CURRENCY_CONTEXT[replaceCurrency] ? `(${CURRENCY_CONTEXT[replaceCurrency]})` : `(${replaceCurrency})`}
          </label>
          <div className={styles.inputWithPrefix}>
            <span className={styles.currencyPrefix} aria-hidden="true">{currencySymbol(replaceCurrency)}</span>
            <input
              id={`${id}-replace-cost`}
              type="number"
              inputMode="decimal"
              className={styles.inputPrefixed}
              value={replaceCost}
              onChange={(e) => setReplaceCost(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              disabled={isSaving}
              aria-label={`Estimated replacement cost in ${replaceCurrency}`}
            />
          </div>
        </div>
      </div>

      {/* Advice / rationale */}
      <div className={styles.field}>
        <label htmlFor={`${id}-description`} className={styles.label}>
          Aisling&apos;s advice
        </label>
        <textarea
          id={`${id}-description`}
          className={styles.textarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Aisling's advice will appear here once the assessment is complete."
          rows={4}
          disabled={isSaving}
        />
      </div>

      {/* Feedback */}
      {saveError && (
        <div className={styles.errorFeedback} role="alert">
          <p className={styles.feedbackText}>{saveError}</p>
        </div>
      )}
      {saveSuccess && (
        <div className={styles.successFeedback} role="status">
          <p className={styles.feedbackText}>Changes saved.</p>
        </div>
      )}

      {/* Post-save navigation CTAs */}
      <AnimatePresence>
        {showNavCtas && (
          <motion.div
            className={styles.navCtas}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {onNavigateBack && (
              <Button
                variant="primary"
                size="md"
                onClick={onNavigateBack}
              >
                {backLabel}
              </Button>
            )}
            {onNavigateNext && hasNextItem ? (
              <Button
                variant="ghost"
                size="md"
                onClick={onNavigateNext}
              >
                Next item
              </Button>
            ) : hasNextItem === false ? (
              <p className={styles.allDoneText} aria-live="polite">All done for now</p>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save button */}
      <div className={styles.actions}>
        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={!hasChanges || isSaving || isDeleting}
        >
          {isSaving ? 'Saving...' : 'Save changes'}
        </Button>
      </div>

      {/* Delete error */}
      {deleteError && (
        <div className={styles.errorFeedback} role="alert">
          <p className={styles.feedbackText}>{deleteError}</p>
        </div>
      )}

      {/* Delete item — destructive, visually separated below Save */}
      <div className={styles.dangerZone}>
        <Button
          ref={deleteButtonRef}
          variant="dangerGhost"
          size="md"
          onClick={() => {
            setDeleteError(null)
            setConfirmDeleteOpen(true)
          }}
          disabled={isSaving || isDeleting}
        >
          {isDeleting ? 'Deleting...' : 'Delete this item'}
        </Button>
      </div>

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => {
          if (!isDeleting) setConfirmDeleteOpen(false)
        }}
        title={`Delete "${item.item_name || 'this item'}"?`}
        description="This removes the photo, all details, and any chat history about this item. This can't be undone."
        confirmLabel="Delete item"
        cancelLabel="Keep item"
        onConfirm={handleDelete}
        isConfirming={isDeleting}
        variant="danger"
        triggerRef={deleteButtonRef}
      />
    </section>
  )
}
