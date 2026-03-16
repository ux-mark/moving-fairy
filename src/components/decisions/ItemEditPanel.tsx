'use client'

import { useState, useCallback, useId } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Button } from '@thefairies/design-system/components'
import type { ItemAssessment } from '@/types'
import type { Verdict } from '@/lib/constants'
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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ItemEditPanelProps {
  item: ItemAssessment
  shipCurrency?: string
  replaceCurrency?: string
  onSave: (updates: Partial<ItemAssessment>) => Promise<void>
  onNavigateBack?: () => void
  onNavigateNext?: () => void
  hasNextItem?: boolean
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

export function ItemEditPanel({ item, shipCurrency = 'USD', replaceCurrency = 'EUR', onSave, onNavigateBack, onNavigateNext, hasNextItem }: ItemEditPanelProps) {
  const id = useId()
  const prefersReducedMotion = useReducedMotion()

  const [name, setName] = useState(item.item_name || '')
  const [verdict, setVerdict] = useState<string>(item.verdict || '')
  const [shipCost, setShipCost] = useState(item.estimated_ship_cost?.toString() ?? '')
  const [replaceCost, setReplaceCost] = useState(item.estimated_replace_cost?.toString() ?? '')
  const [description, setDescription] = useState(item.advice_text || '')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [showNavCtas, setShowNavCtas] = useState(false)

  const hasChanges =
    name !== (item.item_name || '') ||
    verdict !== (item.verdict || '') ||
    shipCost !== (item.estimated_ship_cost?.toString() ?? '') ||
    replaceCost !== (item.estimated_replace_cost?.toString() ?? '') ||
    description !== (item.advice_text || '')

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
      })
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
  }, [name, verdict, shipCost, replaceCost, description, onSave, onNavigateBack])

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

      {/* Costs */}
      <div className={styles.costsRow}>
        <div className={styles.field}>
          <label htmlFor={`${id}-ship-cost`} className={styles.label}>
            Estimated shipping cost ({shipCurrency})
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
            Estimated replacement cost ({replaceCurrency})
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
                Back to decisions
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
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
    </section>
  )
}
