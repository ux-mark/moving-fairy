'use client'

import type { ReactNode } from 'react'

import styles from './Fab.module.css'

interface FabProps {
  /** Visible label next to the icon (hidden on very small viewports). */
  label: string
  /** Icon node — typically a Lucide icon at size 18-20. */
  icon: ReactNode
  /** Called on click. */
  onClick: () => void
  /** Disable the button (greyed, not interactive). */
  disabled?: boolean
  /** Optional title attribute (tooltip). Useful when the label is hidden. */
  title?: string
  /** Accessible label override (defaults to `label`). */
  ariaLabel?: string
}

/**
 * Floating action button anchored bottom-right of the viewport.
 *
 * Use on cockpit pages (/items, /decisions, /boxes, /selling) for the
 * page's primary creation action (capture, new box, new listing).
 */
export function Fab({ label, icon, onClick, disabled, title, ariaLabel }: FabProps) {
  return (
    <button
      type="button"
      className={styles.fab}
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      aria-label={ariaLabel ?? label}
    >
      {icon}
      <span className={styles.label}>{label}</span>
    </button>
  )
}
