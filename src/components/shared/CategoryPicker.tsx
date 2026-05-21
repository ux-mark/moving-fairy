'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@thefairies/design-system/components'

import { ownerCopy } from '@/lib/copy/owner'

import styles from './CategoryPicker.module.css'

// Sentinel chosen so it cannot collide with a real category name (categories
// are trimmed non-empty strings ≤ 80 chars; this value starts with `__`).
const ADD_NEW_VALUE = '__add_new__'
const NO_CATEGORY_VALUE = ''

interface CategoryPickerProps {
  /** Currently selected category — null means "No category". */
  value: string | null
  /** The seller's master list (from seller_settings.categories). */
  categories: string[]
  /** Called when the user picks a category (or chooses "No category"). */
  onChange: (next: string | null) => void
  /**
   * Called when a brand-new category was successfully appended on the
   * server. Receives the full updated list so the parent can keep its
   * own copy in sync without an extra GET.
   */
  onCategoriesUpdated: (nextCategories: string[]) => void
  /** Override the select element's class so it matches the host form. */
  selectClassName?: string | undefined
  /** Override the inline "new category" input class for the same reason. */
  inputClassName?: string | undefined
  /** Stable DOM id for the select — required so the parent label can match. */
  selectId: string
  /** Disable the entire picker (e.g. while the parent form is saving). */
  disabled?: boolean | undefined
}

/**
 * Reusable category picker for the owner-side listing/item editors.
 *
 * Visible states:
 *  1. Select mode (default) — a native <select> showing No category, every
 *     seller category, and a trailing "+ Add new category…" option.
 *  2. Adding mode — an inline text input + Add / Cancel buttons. Add posts
 *     to /api/settings/categories, then auto-selects the new value.
 *
 * Persistence note: this component does not write the chosen value to the
 * item itself — the parent form does, via its own save path. We only own
 * the category-list mutation.
 */
export function CategoryPicker({
  value,
  categories,
  onChange,
  onCategoriesUpdated,
  selectClassName,
  inputClassName,
  selectId,
  disabled,
}: CategoryPickerProps) {
  const inlineId = useId()
  const inlineInputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'select' | 'adding'>('select')
  const [newName, setNewName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Move focus into the inline input the moment "adding" mode is entered.
  // This replaces an autoFocus prop (which trips jsx-a11y/no-autofocus)
  // and keeps keyboard users on a sensible path: select → input → Add/Cancel.
  useEffect(() => {
    if (mode === 'adding') {
      inlineInputRef.current?.focus()
    }
  }, [mode])

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value
    if (next === ADD_NEW_VALUE) {
      setMode('adding')
      setError(null)
      setNewName('')
      return
    }
    onChange(next === NO_CATEGORY_VALUE ? null : next)
  }

  const handleCancelAdd = () => {
    setMode('select')
    setNewName('')
    setError(null)
  }

  const handleSubmitAdd = async () => {
    const trimmed = newName.trim()
    if (!trimmed) {
      // Field is empty — don't post; user clicked Add by mistake.
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? ownerCopy.selling.categoryAddFailed)
      }
      const data = (await res.json()) as { categories?: string[] }
      const nextList = Array.isArray(data.categories) ? data.categories : []
      onCategoriesUpdated(nextList)
      // Pick whichever entry on the new list matches (case-insensitively)
      // — the server may have collapsed duplicates.
      const lower = trimmed.toLowerCase()
      const selected =
        nextList.find((c) => c.toLowerCase() === lower) ?? trimmed
      onChange(selected)
      setMode('select')
      setNewName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : ownerCopy.selling.categoryAddFailed)
    } finally {
      setSubmitting(false)
    }
  }

  // The select's effective value: empty string for null, or the
  // category itself. If the item carries a category that isn't on the
  // master list any more (e.g. it was removed in settings), we still
  // render it as the selected value so the user sees what's set.
  const selectValue = value ?? NO_CATEGORY_VALUE
  const orphanCategory =
    value !== null && !categories.some((c) => c === value) ? value : null

  if (mode === 'adding') {
    return (
      <div className={styles.root}>
        <div className={styles.addRow}>
          <input
            ref={inlineInputRef}
            id={inlineId}
            type="text"
            className={inputClassName ?? styles.input}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={ownerCopy.selling.categoryAddPlaceholder}
            maxLength={80}
            autoComplete="off"
            disabled={submitting}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleSubmitAdd()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                handleCancelAdd()
              }
            }}
            aria-label={ownerCopy.selling.fields.category}
          />
          <div className={styles.addActions}>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={handleCancelAdd}
              disabled={submitting}
            >
              {ownerCopy.selling.categoryAddCancel}
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="button"
              onClick={() => void handleSubmitAdd()}
              disabled={submitting || newName.trim() === ''}
            >
              {submitting ? 'Adding…' : ownerCopy.selling.categoryAddButton}
            </Button>
          </div>
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <select
      id={selectId}
      className={selectClassName ?? styles.select}
      value={selectValue}
      onChange={handleSelectChange}
      disabled={disabled}
    >
      <option value={NO_CATEGORY_VALUE}>{ownerCopy.selling.categoryNoCategory}</option>
      {categories.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
      {orphanCategory && (
        <option key={`orphan-${orphanCategory}`} value={orphanCategory}>
          {orphanCategory}
        </option>
      )}
      <option value={ADD_NEW_VALUE}>{ownerCopy.selling.categoryAddNewOption}</option>
    </select>
  )
}
