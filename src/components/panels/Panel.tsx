'use client'

import { useCallback, useId, useRef } from 'react'
import { GripHorizontal, Minus, Square, X } from 'lucide-react'

import { useIsDesktop } from '@/lib/hooks/useIsDesktop'
import { cn } from '@/lib/utils'

import {
  DEFAULT_PANEL_SIZE,
  MIN_PANEL_HEIGHT,
  MIN_PANEL_WIDTH,
  PANEL_Z_BASE,
  VIEWPORT_MARGIN,
  clampPos,
  defaultPanelPos,
  defaultPanelSize,
} from './placement'
import type { PanelInstance, PanelPos, PanelSize } from './types'
import styles from './Panel.module.css'

interface PanelProps {
  panel: PanelInstance
  /** Position of this panel among open panels on the same side (cascade offset). */
  indexOnSide: number
  children: React.ReactNode
  onClose: () => void
  onMinimise: () => void
  onFocus: () => void
  onMove: (pos: PanelPos) => void
  onResize: (size: PanelSize) => void
}

function viewport(): { w: number; h: number } {
  return { w: window.innerWidth, h: window.innerHeight }
}

/**
 * Floating panel window (spec §1). Desktop (≥1024px): draggable by header,
 * resizable from the bottom-right corner, minimise sends it to the tray.
 * Mobile (<1024px): full-screen sheet — no drag/resize chrome.
 *
 * Drag/resize logic adapted from FloatingChatPanel (pointer capture so move
 * events keep arriving when the cursor leaves the handle).
 */
export function Panel({
  panel,
  indexOnSide,
  children,
  onClose,
  onMinimise,
  onFocus,
  onMove,
  onResize,
}: PanelProps) {
  const isDesktop = useIsDesktop()
  const titleId = useId()

  const size = panel.size ?? (typeof window === 'undefined'
    ? DEFAULT_PANEL_SIZE
    : defaultPanelSize(panel.kind, viewport()))
  const pos = panel.pos ?? (typeof window === 'undefined'
    ? { x: 0, y: 0 }
    : defaultPanelPos(panel.side, size, viewport(), indexOnSide))

  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)
  const resizeStart = useRef<{ mx: number; my: number; w: number; h: number } | null>(null)

  const onHeaderPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.target instanceof Element && e.target.closest('button')) return
      dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [pos.x, pos.y]
  )

  const onHeaderPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragStart.current) return
      const dx = e.clientX - dragStart.current.mx
      const dy = e.clientY - dragStart.current.my
      onMove(
        clampPos(
          { x: dragStart.current.px + dx, y: dragStart.current.py + dy },
          size,
          viewport()
        )
      )
    },
    [onMove, size]
  )

  const onHeaderPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragStart.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }, [])

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation()
      resizeStart.current = { mx: e.clientX, my: e.clientY, w: size.w, h: size.h }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [size.w, size.h]
  )

  const onResizePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!resizeStart.current) return
      const dw = e.clientX - resizeStart.current.mx
      const dh = e.clientY - resizeStart.current.my
      const maxW = Math.max(MIN_PANEL_WIDTH, window.innerWidth - pos.x - VIEWPORT_MARGIN)
      const maxH = Math.max(MIN_PANEL_HEIGHT, window.innerHeight - pos.y - VIEWPORT_MARGIN)
      onResize({
        w: Math.max(MIN_PANEL_WIDTH, Math.min(resizeStart.current.w + dw, maxW)),
        h: Math.max(MIN_PANEL_HEIGHT, Math.min(resizeStart.current.h + dh, maxH)),
      })
    },
    [onResize, pos.x, pos.y]
  )

  const onResizePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    resizeStart.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }, [])

  // Mobile — full-screen sheet, no drag chrome. Minimise sends to tray.
  if (!isDesktop) {
    return (
      <section
        className={styles.mobileSheet}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        style={{ zIndex: PANEL_Z_BASE + panel.zIndex }}
      >
        <header className={styles.mobileHeader}>
          <h2 id={titleId} className={styles.mobileTitle}>
            {panel.title}
          </h2>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={onMinimise}
              aria-label={`Minimise ${panel.title}`}
              title="Minimise"
            >
              <Minus size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={onClose}
              aria-label={`Close ${panel.title}`}
              title="Close"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className={styles.body}>{children}</div>
      </section>
    )
  }

  return (
    <section
      className={styles.panel}
      style={{
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        zIndex: PANEL_Z_BASE + panel.zIndex,
      }}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      onPointerDownCapture={onFocus}
    >
      <div
        className={styles.header}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
      >
        <GripHorizontal size={14} aria-hidden="true" className={styles.gripIcon} />
        <h2 id={titleId} className={cn(styles.title, styles.desktopTitle)}>
          {panel.title}
        </h2>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onMinimise}
            aria-label={`Minimise ${panel.title}`}
            title="Minimise"
          >
            <Minus size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onClose}
            aria-label={`Close ${panel.title}`}
            title="Close"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={styles.body}>{children}</div>

      <div
        className={styles.resizeHandle}
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerUp}
        role="presentation"
        aria-hidden="true"
      >
        <Square size={10} aria-hidden="true" />
      </div>
    </section>
  )
}
