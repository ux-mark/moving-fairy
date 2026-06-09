'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'
import styles from './Drawer.module.css'

interface DrawerProps {
  /** Short label above the title (e.g. "Item detail"). Optional. */
  eyebrow?: string
  /** Drawer title — the main thing the user is looking at. */
  title: string
  /** Body content. The drawer provides a flex column container; child decides its own scroll. */
  children: ReactNode
  /** Optional content to slot between the title and the close button (e.g. "Full view" link). */
  headerActions?: ReactNode
  /** Called when the user closes the drawer via backdrop, Escape, or X. */
  onClose: () => void
  /** Width tier. md=560px, lg=640px, xl=760px (each grows on wider viewports). */
  size?: 'md' | 'lg' | 'xl'
  /** Accessible label for the drawer root — defaults to "Detail panel". */
  ariaLabel?: string
}

/**
 * Right-side slide-in panel.
 *
 * - Non-modal by default — list behind stays visible and scrollable
 * - Escape closes
 * - Focus moves to the close button on open
 * - On unmount, focus returns to the previously-focused element
 * - Reduced-motion respected (no slide animation)
 * - Backdrop click closes
 */
export function Drawer({
  eyebrow,
  title,
  children,
  headerActions,
  onClose,
  size = 'md',
  ariaLabel,
}: DrawerProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null
    closeBtnRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      // Restore focus on close so keyboard users return to their place.
      previousFocusRef.current?.focus?.()
    }
  }, [onClose])

  return (
    <div
      className={styles.root}
      role="dialog"
      aria-modal="false"
      aria-label={ariaLabel ?? title}
    >
      <button
        type="button"
        className={styles.backdrop}
        onClick={onClose}
        aria-label="Close panel"
        tabIndex={-1}
      />
      <section className={cn(styles.sheet, styles[`size${size.charAt(0).toUpperCase()}${size.slice(1)}`])}>
        <header className={styles.header}>
          <div className={styles.headerText}>
            {eyebrow && <p className={styles.headerEyebrow}>{eyebrow}</p>}
            <h2 className={styles.headerTitle}>{title}</h2>
          </div>
          {headerActions && <div className={styles.headerActions}>{headerActions}</div>}
          <button
            ref={closeBtnRef}
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </section>
    </div>
  )
}
