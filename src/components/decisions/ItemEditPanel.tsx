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
  // Owner-facing description: quantity, contents, biosecurity detail. Distinct
  // from `advice_text` (Aisling's reasoning, edited lower down).
  const [itemDescription, setItemDescription] = useState(item.item_description ?? '')
  // Verdict is controlled by the panel's verdict header strip, not this form —
  // derive it from props so an external change (strip, other device) is always
  // current in the conditional fields and the save payload.
  const verdict = item.verdict || ''
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
    itemDescription !== (item.item_description ?? '') ||
    shipCost !== (item.estimated_ship_cost?.toString() ?? '') ||
    replaceCost !== (item.estimated_replace_cost?.toString() ?? '') ||
    description !== (item.advice_text || '') ||
    boxId !== (currentBoxId ?? '') ||
    targetShipmentId !== (item.target_shipment_id ?? '') ||
    category !== (item.category ?? null) ||
    careChanged

  // Re-seed from props when the item changes underneath the form (realtime
  // update, save echo) — but only while the form is clean RELATIVE TO WHAT IT
  // WAS SEEDED FROM. A background update while the user is mid-edit must not
  // stomp typed input; their values stay and the save flow reconciles.
  const fieldsRef = useRef({ name, itemDescription, shipCost, replaceCost, description, boxId, targetShipmentId, category, care })
  fieldsRef.current = { name, itemDescription, shipCost, replaceCost, description, boxId, targetShipmentId, category, care }
  const seededRef = useRef({ item, boxId: currentBoxId ?? '' })
  useEffect(() => {
    const seeded = seededRef.current
    const nextBoxId = currentBoxId ?? ''
    if (seeded.item === item && seeded.boxId === nextBoxId) return
    const f = fieldsRef.current
    const dirty =
      f.name !== (seeded.item.item_name || '') ||
      f.itemDescription !== (seeded.item.item_description ?? '') ||
      f.shipCost !== (seeded.item.estimated_ship_cost?.toString() ?? '') ||
      f.replaceCost !== (seeded.item.estimated_replace_cost?.toString() ?? '') ||
      f.description !== (seeded.item.advice_text || '') ||
      f.boxId !== seeded.boxId ||
      f.targetShipmentId !== (seeded.item.target_shipment_id ?? '') ||
      f.category !== (seeded.item.category ?? null) ||
      JSON.stringify(f.care) !== JSON.stringify(seeded.item.care ?? null)
    seededRef.current = { item, boxId: nextBoxId }
    if (dirty) return
    setName(item.item_name || '')
    setItemDescription(item.item_description ?? '')
    setShipCost(item.estimated_ship_cost?.toString() ?? '')
    setReplaceCost(item.estimated_replace_cost?.toString() ?? '')
    setDescription(item.advice_text || '')
    setBoxId(nextBoxId)
    setTargetShipmentId(item.target_shipment_id ?? '')
    setCategory(item.category ?? null)
    setCare(item.care ?? null)
  }, [item, currentBoxId])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    setShowNavCtas(false)
    try {
      await onSave({
        item_name: name,
        item_description: itemDescription.trim() === '' ? null : itemDescription.trim(),
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
  }, [name, itemDescription, verdict, shipCost, replaceCost, description, boxId, currentBoxId, targetShipmentId, category, care, careChanged, item.id, onSave, onNavigateBack])

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

  return (
    <section className={styles.root} aria-label="Edit item details">
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

      {/* Description — owner-facing detail: quantity, contents, condition.
          Especially important for biosecurity items on the inventory list. */}
      <div className={styles.field}>
        <label htmlFor={`${id}-item-description`} className={styles.label}>
          Description
        </label>
        <textarea
          id={`${id}-item-description`}
          className={styles.textarea}
          value={itemDescription}
          onChange={(e) => setItemDescription(e.target.value)}
          placeholder="Quantity, contents, condition — e.g. “2 oak bowls, treated timber” or “6 books”. Helps with biosecurity and the manifest."
          rows={3}
          maxLength={1000}
          disabled={isSaving}
        />
      </div>

      {/* Costs — edited most often after the verdict, so they come first. */}
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

      {/* Shipment leg — only render when the move has more than one leg. */}
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

      {/* Category — owner-defined master list. */}
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

      {/* Plant care — visible only when this item is a plant. */}
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

      {/* Aisling's reasoning — single source of truth. Open by default
          when the item is unconfirmed (the user is still deciding and
          benefits from reading the rationale); collapsed once confirmed
          to keep the panel compact for cost / box edits. */}
      <details
        className={styles.adviceField}
        {...(!item.user_confirmed ? { open: true } : {})}
      >
        <summary className={styles.adviceFieldSummary}>
          Aisling&rsquo;s reasoning
        </summary>
        <div className={styles.field}>
          <label htmlFor={`${id}-description`} className={styles.srOnly}>
            Aisling&apos;s reasoning
          </label>
          <textarea
            id={`${id}-description`}
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Aisling's reasoning will appear here once the assessment is complete."
            rows={4}
            disabled={isSaving}
          />
        </div>
      </details>

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

      {/* Delete error — surfaced above the actions row so the user sees it
          alongside both the destructive and primary controls. */}
      {deleteError && (
        <div className={styles.errorFeedback} role="alert">
          <p className={styles.feedbackText}>{deleteError}</p>
        </div>
      )}

      {/* Form actions row: destructive far-left, primary far-right.
          Per UX_PATTERNS.md § 12, destructive lives left, separated by
          space-between so it's never mistaken for the next-step CTA. */}
      <div className={styles.formActions}>
        <Button
          ref={deleteButtonRef}
          variant="ghost"
          size="md"
          onClick={() => {
            setDeleteError(null)
            setConfirmDeleteOpen(true)
          }}
          disabled={isSaving || isDeleting}
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={!hasChanges || isSaving || isDeleting}
        >
          {isSaving ? 'Saving...' : 'Save changes'}
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
