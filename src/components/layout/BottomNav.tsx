'use client'

import { cn } from '@/lib/utils'

import styles from './BottomNav.module.css'

export interface BottomNavItem {
  key: string
  label: string
  icon: React.ComponentType<{ size?: number }>
}

interface BottomNavProps {
  items: BottomNavItem[]
  activeKey: string
  onNavigate: (key: string) => void
}

/**
 * Bottom tab bar — primary navigation on <1024px viewports (spec §4).
 * The DS Navigation has no bottom variant, so this is the mobile
 * counterpart: icon + label per tab (never icon-only), active state via
 * weight + top indicator (not colour alone), ≥44px targets, safe-area
 * inset padding. Hidden on desktop where the DS top Navigation remains.
 */
export function BottomNav({ items, activeKey, onNavigate }: BottomNavProps) {
  return (
    <nav className={styles.bottomNav} aria-label="Primary">
      <ul className={styles.list}>
        {items.map(({ key, label, icon: Icon }) => {
          const isActive = key === activeKey
          return (
            <li key={key} className={styles.item}>
              <button
                type="button"
                className={cn(styles.tab, isActive && styles.tabActive)}
                onClick={() => onNavigate(key)}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className={styles.icon} aria-hidden="true">
                  <Icon size={20} />
                </span>
                <span className={styles.label}>{label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
