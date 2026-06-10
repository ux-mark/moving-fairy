'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronDown, Package, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { UNPACKED } from '@/lib/items/package-filter'

import styles from './PackageFilter.module.css'

export interface PackageOption {
  /** Box id, or UNPACKED ('none') for the "Unpacked" pseudo-package. */
  id: string
  label: string
  /** Number of inventory items in this package. */
  count: number
}

interface PillProps {
  options: PackageOption[]
  selectedIds: string[]
  onToggle: (id: string) => void
}

/**
 * "Package" filter pill: opens a multi-select checkbox dropdown of the user's
 * boxes/luggage plus "Unpacked". Follows the EditablePill interaction pattern
 * (listbox + roving focus), but selecting toggles without closing.
 */
export function PackageFilterPill({ options, selectedIds, onToggle }: PillProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listboxId = useId()

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  // Move DOM focus with the active index (keyboard nav)
  useEffect(() => {
    if (!open || activeIndex < 0) return
    const items = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')
    items?.[activeIndex]?.focus()
  }, [open, activeIndex])

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false)
    setActiveIndex(-1)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  const handleTriggerClick = useCallback(() => {
    if (open) {
      close(false)
    } else {
      setActiveIndex(0)
      setOpen(true)
    }
  }, [open, close])

  const handleTriggerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'ArrowDown' && !open) {
        e.preventDefault()
        setActiveIndex(0)
        setOpen(true)
      } else if (e.key === 'Escape' && open) {
        e.preventDefault()
        close(true)
      }
    },
    [open, close],
  )

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close(true)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((prev) => (prev + 1) % options.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((prev) => (prev - 1 + options.length) % options.length)
      } else if (e.key === 'Home') {
        e.preventDefault()
        setActiveIndex(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setActiveIndex(options.length - 1)
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        const option = options[activeIndex]
        if (option) onToggle(option.id) // toggle, keep the dropdown open
      } else if (e.key === 'Tab') {
        close(false)
      }
    },
    [options, activeIndex, onToggle, close],
  )

  const selectedCount = selectedIds.length

  return (
    <div ref={containerRef} className={styles.wrapper}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={
          selectedCount > 0
            ? `Filter by package: ${selectedCount} selected`
            : 'Filter by package'
        }
        className={cn(styles.trigger, selectedCount > 0 && styles.triggerActive)}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
      >
        <Package size={16} aria-hidden="true" />
        <span>Package</span>
        {selectedCount > 0 && <span className={styles.triggerCount}>({selectedCount})</span>}
        <ChevronDown
          size={14}
          className={cn(styles.chevron, open && styles.chevronOpen)}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-multiselectable="true"
          aria-label="Filter by package"
          className={styles.dropdown}
          onKeyDown={handleListKeyDown}
        >
          {options.map((option, index) => {
            const isSelected = selectedIds.includes(option.id)
            return (
              <li key={option.id} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={-1}
                  className={cn(styles.option, index === activeIndex && styles.optionActive)}
                  onClick={() => {
                    setActiveIndex(index)
                    onToggle(option.id)
                  }}
                >
                  <span className={cn(styles.checkbox, isSelected && styles.checkboxChecked)} aria-hidden="true">
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className={styles.optionLabel}>{option.label}</span>
                  <span className={styles.optionCount}>({option.count})</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

interface SelectedPillsProps {
  selected: PackageOption[]
  onRemove: (id: string) => void
  onClearAll: () => void
}

/**
 * Removable pills for the active package filters, shown above the item list.
 * Pills exit with a small pop-and-fade (opacity-only under reduced motion);
 * "Clear all" appears once 2+ are selected.
 */
export function SelectedPackagePills({ selected, onRemove, onClearAll }: SelectedPillsProps) {
  const prefersReducedMotion = useReducedMotion()

  if (selected.length === 0) return null

  return (
    <div className={styles.selectedRow} role="group" aria-label="Active package filters">
      <AnimatePresence mode="popLayout" initial={false}>
        {selected.map((pkg) => (
          <motion.span
            key={pkg.id}
            layout={!prefersReducedMotion}
            className={styles.selectedPill}
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.7, y: -6 }
            }
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { type: 'spring', stiffness: 500, damping: 30 }
            }
          >
            <Package size={13} aria-hidden="true" />
            <span className={styles.selectedLabel}>{pkg.label}</span>
            <button
              type="button"
              className={styles.removeButton}
              aria-label={`Remove ${pkg.label} filter`}
              onClick={() => onRemove(pkg.id)}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </motion.span>
        ))}
        {selected.length >= 2 && (
          <motion.button
            key="clear-all"
            type="button"
            layout={!prefersReducedMotion}
            className={styles.clearAll}
            onClick={onClearAll}
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
          >
            Clear all
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

export { UNPACKED }
