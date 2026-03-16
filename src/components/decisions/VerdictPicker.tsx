'use client'

import { useCallback, useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Verdict } from '@/lib/constants'
import styles from './VerdictPicker.module.css'

const VERDICT_OPTIONS: { value: Verdict; label: string }[] = [
  { value: 'SHIP',    label: 'Ship' },
  { value: 'CARRY',   label: 'Carry' },
  { value: 'SELL',    label: 'Sell' },
  { value: 'DONATE',  label: 'Donate' },
  { value: 'DISCARD', label: 'Discard' },
  { value: 'REVISIT', label: 'Decide later' },
]

const VERDICT_COLORS: Record<Verdict, { bg: string; fg: string }> = {
  SHIP:    { bg: 'var(--verdict-ship-bg)',         fg: 'var(--verdict-ship-fg)' },
  CARRY:   { bg: 'var(--verdict-carry-bg)',        fg: 'var(--verdict-carry-fg)' },
  SELL:    { bg: 'var(--verdict-sell-bg)',         fg: 'var(--verdict-sell-fg)' },
  DONATE:  { bg: 'var(--verdict-donate-bg)',       fg: 'var(--verdict-donate-fg)' },
  DISCARD: { bg: 'var(--verdict-discard-bg)',      fg: 'var(--verdict-discard-fg)' },
  REVISIT: { bg: 'var(--verdict-decide-later-bg)', fg: 'var(--verdict-decide-later-fg)' },
}

interface VerdictPickerProps {
  currentVerdict: Verdict | null
  isOpen: boolean
  onClose: () => void
  onVerdictChange: (verdict: Verdict) => Promise<void>
  /** Optional label for the trigger context (item name) */
  itemName?: string
}

export function VerdictPicker({
  currentVerdict,
  isOpen,
  onClose,
  onVerdictChange,
  itemName,
}: VerdictPickerProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const firstItemRef = useRef<HTMLButtonElement>(null)

  // Focus first item when opened
  useEffect(() => {
    if (isOpen) {
      // Microtask to ensure DOM is visible before focusing
      Promise.resolve().then(() => {
        firstItemRef.current?.focus()
      })
    }
  }, [isOpen])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (e: PointerEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen, onClose])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const items = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')
      if (!items) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = items[(index + 1) % items.length]
        next?.focus()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = items[(index - 1 + items.length) % items.length]
        prev?.focus()
      } else if (e.key === 'Home') {
        e.preventDefault()
        items[0]?.focus()
      } else if (e.key === 'End') {
        e.preventDefault()
        items[items.length - 1]?.focus()
      }
    },
    []
  )

  const handleSelect = useCallback(
    async (verdict: Verdict) => {
      if (verdict === currentVerdict) {
        onClose()
        return
      }
      onClose()
      await onVerdictChange(verdict)
    },
    [currentVerdict, onClose, onVerdictChange]
  )

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop — mobile only */}
      <div
        className={styles.backdrop}
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        ref={listRef}
        className={styles.container}
        role="listbox"
        aria-label={itemName ? `Change verdict for ${itemName}` : 'Change verdict'}
        aria-activedescendant={currentVerdict ? `verdict-option-${currentVerdict}` : undefined}
        tabIndex={-1}
      >
        <div className={styles.header}>
          <span className={styles.headerLabel}>Change verdict</span>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close verdict picker"
          >
            ✕
          </button>
        </div>

        <div className={styles.optionList}>
          {VERDICT_OPTIONS.map(({ value, label }, index) => {
            const colors = VERDICT_COLORS[value]
            const isSelected = value === currentVerdict

            return (
              <button
                key={value}
                id={`verdict-option-${value}`}
                ref={index === 0 ? firstItemRef : undefined}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={cn(styles.option, isSelected && styles.optionSelected)}
                onClick={() => handleSelect(value)}
                onKeyDown={(e) => handleKeyDown(e, index)}
              >
                <span
                  className={styles.colorSwatch}
                  style={{ backgroundColor: colors.bg, outline: `2px solid ${colors.fg}`, outlineOffset: '-2px' }}
                  aria-hidden="true"
                />
                <span className={styles.optionLabel}>{label}</span>
                {isSelected && (
                  <Check
                    className={styles.checkIcon}
                    style={{ color: colors.fg }}
                    aria-hidden="true"
                    size={16}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
