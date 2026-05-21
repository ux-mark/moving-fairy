'use client'

import { useId } from 'react'
import { ChevronDown } from 'lucide-react'

import { Field } from '@/components/shared/Field'
import type { PlantCare } from '@/types/database'

import styles from './PlantCareEditor.module.css'

type CareLevel = 1 | 2 | 3

interface PlantCareEditorProps {
  value: PlantCare | null
  onChange: (next: PlantCare | null) => void
  disabled?: boolean | undefined
  /**
   * Override the inline text input class so the controls visually match
   * the host form's inputs (same height, border, focus ring).
   */
  inputClassName?: string | undefined
  /**
   * Override the select class for the same reason.
   */
  selectClassName?: string | undefined
  /**
   * Override the textarea class for the same reason.
   */
  textareaClassName?: string | undefined
}

const LIGHT_LEVELS: Array<{ value: CareLevel; label: string }> = [
  { value: 1, label: '1 Low' },
  { value: 2, label: '2 Medium' },
  { value: 3, label: '3 Bright' },
]

const WATER_LEVELS: Array<{ value: CareLevel; label: string }> = [
  { value: 1, label: '1 Sparse' },
  { value: 2, label: '2 Medium' },
  { value: 3, label: '3 Frequent' },
]

const FEED_LEVELS: Array<{ value: CareLevel; label: string }> = [
  { value: 1, label: '1 Sparse' },
  { value: 2, label: '2 Monthly' },
  { value: 3, label: '3 Weekly' },
]

/**
 * Normalise a PlantCare patch:
 *  - trim text fields, drop empties
 *  - keep `*_level` only when it's a valid CareLevel
 *  - if every field is empty after normalisation, return null so the row's
 *    `care` column stays `NULL` rather than `{}` (matches API + schema intent)
 */
function normalise(next: PlantCare): PlantCare | null {
  const out: PlantCare = {}
  const trim = (s: string | undefined): string | undefined => {
    if (s === undefined) return undefined
    const t = s.trim()
    return t === '' ? undefined : t
  }

  const light = trim(next.light)
  if (light !== undefined) out.light = light
  if (next.light_level === 1 || next.light_level === 2 || next.light_level === 3) {
    out.light_level = next.light_level
  }

  const water = trim(next.water)
  if (water !== undefined) out.water = water
  if (next.water_level === 1 || next.water_level === 2 || next.water_level === 3) {
    out.water_level = next.water_level
  }

  const soil = trim(next.soil)
  if (soil !== undefined) out.soil = soil

  const feed = trim(next.feed)
  if (feed !== undefined) out.feed = feed
  if (next.feed_level === 1 || next.feed_level === 2 || next.feed_level === 3) {
    out.feed_level = next.feed_level
  }

  const summary = trim(next.summary)
  if (summary !== undefined) out.summary = summary

  return Object.keys(out).length === 0 ? null : out
}

/**
 * Parse the level-select value back into a 1|2|3 (or undefined).
 * Empty string means "not set" — drop the key.
 */
function parseLevel(raw: string): CareLevel | undefined {
  if (raw === '1') return 1
  if (raw === '2') return 2
  if (raw === '3') return 3
  return undefined
}

/**
 * Has the owner set any care field on this item? Drives default open/closed.
 */
function hasAnyCare(value: PlantCare | null): boolean {
  if (!value) return false
  return Boolean(
    value.light ||
      value.light_level ||
      value.water ||
      value.water_level ||
      value.soil ||
      value.feed ||
      value.feed_level ||
      value.summary,
  )
}

/**
 * Owner-side editor for `item_assessment.care`. Lives inside the parent form
 * (no autosave) — the parent collects the next value via `onChange` and
 * persists it through its own save flow.
 *
 * Collapsed by default when empty; opens automatically if Aisling (or the
 * owner) has already set any field. Toggling never changes `value`.
 */
export function PlantCareEditor({
  value,
  onChange,
  disabled,
  inputClassName,
  selectClassName,
  textareaClassName,
}: PlantCareEditorProps) {
  const id = useId()
  const care: PlantCare = value ?? {}
  const defaultOpen = hasAnyCare(value)

  // Build a "next" PlantCare from the current value plus a partial override.
  // Anything explicitly set to undefined is treated as "remove this key"
  // (required by `exactOptionalPropertyTypes: true` in tsconfig).
  type PatchValue = string | CareLevel | undefined
  const patch = (changes: Partial<Record<keyof PlantCare, PatchValue>>) => {
    const merged: PlantCare = { ...care }
    for (const [k, v] of Object.entries(changes) as Array<[keyof PlantCare, PatchValue]>) {
      if (v === undefined) {
        delete merged[k]
      } else if (k === 'light_level' || k === 'water_level' || k === 'feed_level') {
        if (v === 1 || v === 2 || v === 3) merged[k] = v
      } else if (typeof v === 'string') {
        merged[k] = v
      }
    }
    onChange(normalise(merged))
  }

  const handleClear = () => {
    onChange(null)
  }

  return (
    <details className={styles.card} open={defaultOpen} aria-label="Plant care">
      <summary className={styles.summary}>
        <div className={styles.summaryLeft}>
          <h3 className={styles.heading}>Plant care</h3>
          <p className={styles.summaryHint}>
            {defaultOpen
              ? 'Light, water, soil and feeding notes for the buyer.'
              : 'Add light, water, soil and feeding notes for the buyer.'}
          </p>
        </div>
        <ChevronDown size={20} aria-hidden="true" className={styles.chevron} />
      </summary>

      <div className={styles.body}>
        <div className={styles.pairRow}>
          {/* Light label + level */}
          <div className={styles.pair}>
            <label htmlFor={`${id}-light`} className={styles.pairLabel}>
              Light
            </label>
            <div className={styles.pairControls}>
              <input
                id={`${id}-light`}
                type="text"
                className={inputClassName}
                value={care.light ?? ''}
                onChange={(e) => patch({ light: e.target.value })}
                placeholder="e.g. Bright, indirect"
                maxLength={200}
                disabled={disabled}
                autoComplete="off"
              />
              <select
                aria-label="Light level"
                className={selectClassName}
                value={care.light_level ?? ''}
                onChange={(e) =>
                  patch({ light_level: parseLevel(e.target.value) })
                }
                disabled={disabled}
              >
                <option value="">Level</option>
                {LIGHT_LEVELS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Water label + level */}
          <div className={styles.pair}>
            <label htmlFor={`${id}-water`} className={styles.pairLabel}>
              Water
            </label>
            <div className={styles.pairControls}>
              <input
                id={`${id}-water`}
                type="text"
                className={inputClassName}
                value={care.water ?? ''}
                onChange={(e) => patch({ water: e.target.value })}
                placeholder="e.g. Let topsoil dry out"
                maxLength={200}
                disabled={disabled}
                autoComplete="off"
              />
              <select
                aria-label="Water level"
                className={selectClassName}
                value={care.water_level ?? ''}
                onChange={(e) =>
                  patch({ water_level: parseLevel(e.target.value) })
                }
                disabled={disabled}
              >
                <option value="">Level</option>
                {WATER_LEVELS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Soil */}
        <Field label="Soil" htmlFor={`${id}-soil`}>
          <input
            id={`${id}-soil`}
            type="text"
            className={inputClassName}
            value={care.soil ?? ''}
            onChange={(e) => patch({ soil: e.target.value })}
            placeholder="e.g. Free-draining cactus mix"
            maxLength={200}
            disabled={disabled}
            autoComplete="off"
          />
        </Field>

        {/* Feed label + level */}
        <div className={styles.pair}>
          <label htmlFor={`${id}-feed`} className={styles.pairLabel}>
            Feed
          </label>
          <div className={styles.pairControls}>
            <input
              id={`${id}-feed`}
              type="text"
              className={inputClassName}
              value={care.feed ?? ''}
              onChange={(e) => patch({ feed: e.target.value })}
              placeholder="e.g. Balanced liquid feed"
              maxLength={200}
              disabled={disabled}
              autoComplete="off"
            />
            <select
              aria-label="Feed frequency"
              className={selectClassName}
              value={care.feed_level ?? ''}
              onChange={(e) =>
                patch({ feed_level: parseLevel(e.target.value) })
              }
              disabled={disabled}
            >
              <option value="">Level</option>
              {FEED_LEVELS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary */}
        <Field
          label="Summary"
          htmlFor={`${id}-summary`}
          hint="Three to five lines a buyer can follow at a glance."
        >
          <textarea
            id={`${id}-summary`}
            className={textareaClassName}
            value={care.summary ?? ''}
            onChange={(e) => patch({ summary: e.target.value })}
            placeholder="A few lines on how to keep this plant happy."
            rows={4}
            maxLength={1000}
            disabled={disabled}
          />
        </Field>

        <div className={styles.footerRow}>
          <button
            type="button"
            className={styles.clearBtn}
            onClick={handleClear}
            disabled={disabled || !hasAnyCare(value)}
          >
            Clear plant care
          </button>
        </div>
      </div>
    </details>
  )
}
