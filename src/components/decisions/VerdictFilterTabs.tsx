'use client'

import { useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { Verdict } from '@/lib/constants'
import styles from './VerdictFilterTabs.module.css'

interface FilterOption {
  value: Verdict | null
  label: string
  pluralLabel: string
}

const FILTER_OPTIONS: FilterOption[] = [
  { value: null,      label: 'All',          pluralLabel: 'All' },
  { value: 'SHIP',    label: 'Ship',         pluralLabel: 'Shipping' },
  { value: 'CARRY',   label: 'Carry',        pluralLabel: 'Carrying' },
  { value: 'SELL',    label: 'Sell',         pluralLabel: 'Selling' },
  { value: 'DONATE',  label: 'Donate',       pluralLabel: 'Donating' },
  { value: 'DISCARD', label: 'Discard',      pluralLabel: 'Discarding' },
  { value: 'REVISIT', label: 'Decide later', pluralLabel: 'Decide later' },
]

const VERDICT_COLORS: Record<Verdict, { bg: string; fg: string }> = {
  SHIP:    { bg: 'var(--verdict-ship-bg)',         fg: 'var(--verdict-ship-fg)' },
  CARRY:   { bg: 'var(--verdict-carry-bg)',        fg: 'var(--verdict-carry-fg)' },
  SELL:    { bg: 'var(--verdict-sell-bg)',         fg: 'var(--verdict-sell-fg)' },
  DONATE:  { bg: 'var(--verdict-donate-bg)',       fg: 'var(--verdict-donate-fg)' },
  DISCARD: { bg: 'var(--verdict-discard-bg)',      fg: 'var(--verdict-discard-fg)' },
  REVISIT: { bg: 'var(--verdict-decide-later-bg)', fg: 'var(--verdict-decide-later-fg)' },
}

interface VerdictFilterTabsProps {
  countsByVerdict: Record<string, number>
  activeFilter: Verdict | null
  onFilterChange: (verdict: Verdict | null) => void
}

function getCount(countsByVerdict: Record<string, number>, value: Verdict | null): number {
  if (value === null) {
    return Object.values(countsByVerdict).reduce((sum, n) => sum + n, 0)
  }
  return countsByVerdict[value] ?? 0
}

export function VerdictFilterTabs({
  countsByVerdict,
  activeFilter,
  onFilterChange,
}: VerdictFilterTabsProps) {
  const listRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const tabs = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      if (!tabs) return

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        const next = tabs[(index + 1) % tabs.length]
        next?.focus()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        const prev = tabs[(index - 1 + tabs.length) % tabs.length]
        prev?.focus()
      } else if (e.key === 'Home') {
        e.preventDefault()
        tabs[0]?.focus()
      } else if (e.key === 'End') {
        e.preventDefault()
        tabs[tabs.length - 1]?.focus()
      }
    },
    []
  )

  // Show all options; zero-count chips are dimmed but still rendered for discoverability
  const allOptions = FILTER_OPTIONS

  return (
    <div className={styles.root}>
      <div
        ref={listRef}
        className={styles.tabList}
        role="tablist"
        aria-label="Filter items by verdict"
      >
        {allOptions.map(({ value, pluralLabel }, index) => {
          const count = getCount(countsByVerdict, value)
          const isActive = value === activeFilter
          const isEmpty = count === 0 && value !== null
          const colors = value ? VERDICT_COLORS[value] : null

          const activeStyle = isActive && colors
            ? { backgroundColor: colors.bg, color: colors.fg, borderColor: colors.bg }
            : isActive
            ? undefined
            : undefined

          return (
            <button
              key={value ?? 'all'}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls="decisions-list"
              className={cn(
                styles.tab,
                isActive && styles.tabActive,
                isEmpty && styles.tabEmpty,
                isActive && value && styles.tabActiveVerdict
              )}
              style={activeStyle ?? undefined}
              onClick={() => onFilterChange(value)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              tabIndex={isActive ? 0 : -1}
            >
              <span className={styles.tabLabel}>
                {pluralLabel}
                {' '}
                <span className={styles.tabCount}>
                  ({count})
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Fade gradient — right edge, indicates scrollability on mobile */}
      <div className={styles.fadeRight} aria-hidden="true" />

      {/* Aria-live region: announces count when filter changes */}
      <span
        className={styles.srOnly}
        aria-live="polite"
        role="status"
      >
        {activeFilter === null
          ? `Showing all ${getCount(countsByVerdict, null)} items`
          : `Showing ${getCount(countsByVerdict, activeFilter)} ${FILTER_OPTIONS.find(o => o.value === activeFilter)?.pluralLabel ?? ''} items`}
      </span>
    </div>
  )
}
