'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GripHorizontal, Maximize2, Minus, Square, X } from 'lucide-react'

import { PerItemChat } from '@/components/decisions/PerItemChat'
import { cn } from '@/lib/utils'
import type { ItemAssessment } from '@/types'

import styles from './FloatingChatPanel.module.css'

interface FloatingChatPanelProps {
  itemId: string
  itemName: string
  thumbnailUrl?: string | undefined
  onClose: () => void
  chatRefreshTrigger?: number | undefined
  onAssessmentUpdated?: ((updated: ItemAssessment) => void) | undefined
}

const DEFAULT_WIDTH = 400
const DEFAULT_HEIGHT = 560
const MIN_WIDTH = 320
const MIN_HEIGHT = 320
const MARGIN = 16
// DS Navigation is 56px tall and z-index 100 (sticky). The panel z-orders
// above it, but we still don't WANT the panel sitting under the nav — it'd
// cover the user's navigation context. Clamp y so the panel can never be
// dragged into the nav strip + a small breathing margin.
const NAV_HEIGHT = 56
const TOP_GUARD = NAV_HEIGHT + MARGIN

const STORAGE_POS = 'mf:chat.pos'
const STORAGE_SIZE = 'mf:chat.size'
const STORAGE_MIN = 'mf:chat.min'

type Pos = { x: number; y: number }
type Size = { w: number; h: number }

function clampPos(p: Pos, s: Size): Pos {
  if (typeof window === 'undefined') return p
  return {
    x: Math.max(MARGIN, Math.min(p.x, Math.max(MARGIN, window.innerWidth - s.w - MARGIN))),
    y: Math.max(TOP_GUARD, Math.min(p.y, Math.max(TOP_GUARD, window.innerHeight - s.h - MARGIN))),
  }
}

// Right-side detail drawer at sizeLg occupies roughly 640-800px of the
// viewport. Defaulting the chat to sit immediately left of the drawer
// puts it where the user just clicked the toggle — no "where did it go?"
// moment. User can drag anywhere; localStorage remembers.
const DRAWER_WIDTH_ESTIMATE = 720

function defaultPos(s: Size): Pos {
  if (typeof window === 'undefined') return { x: 0, y: 0 }
  const idealX = window.innerWidth - DRAWER_WIDTH_ESTIMATE - s.w - MARGIN
  // Start vertically centred in the space BELOW the nav so the panel
  // doesn't open behind chrome.
  const availableHeight = Math.max(s.h, window.innerHeight - TOP_GUARD)
  const idealY = TOP_GUARD + Math.round((availableHeight - s.h) / 2)
  return {
    x: Math.max(MARGIN, idealX),
    y: Math.max(TOP_GUARD, idealY),
  }
}

// Read viewport synchronously on client first render to avoid a one-frame
// flash of the mobile sheet before the desktop floating panel renders.
// Safe to use a lazy initializer here because this component only mounts
// after a user click — it never SSRs, so no hydration mismatch.
function readIsDesktop(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(min-width: 1024px)').matches
}

/**
 * Floating, draggable, resizable chat panel.
 *
 * Desktop (≥1024px): fixed-position panel anchored bottom-right by default.
 * Drag the header to move; drag the bottom-right corner to resize. State
 * (position, size, minimised) persists in localStorage so the panel stays
 * where the user put it across sessions and across item switches.
 *
 * Mobile: a full-screen slide-up sheet — drag/resize makes no sense on a
 * phone. The desktop chrome (grip, minimise, resize) is hidden.
 *
 * The chat itself is per-item. When the host swaps `itemId`, the chat
 * re-fetches history for the new item via its internal effect.
 */
export function FloatingChatPanel({
  itemId,
  itemName,
  thumbnailUrl,
  onClose,
  chatRefreshTrigger,
  onAssessmentUpdated,
}: FloatingChatPanelProps) {
  // Read viewport synchronously on mount — see readIsDesktop comment above.
  // Tracked in state so a viewport resize across the breakpoint re-renders.
  const [isDesktop, setIsDesktop] = useState<boolean>(readIsDesktop)
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)')
    const update = () => setIsDesktop(mql.matches)
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  const [size, setSize] = useState<Size>({ w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT })
  const [pos, setPos] = useState<Pos>({ x: 0, y: 0 })
  const [minimised, setMinimised] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)
  const resizeStart = useRef<{ mx: number; my: number; w: number; h: number } | null>(null)

  // Hydrate from localStorage on mount. Server-render is "not hydrated" so
  // we don't flash a panel at the wrong position before reading storage.
  useEffect(() => {
    try {
      const savedSize = JSON.parse(localStorage.getItem(STORAGE_SIZE) ?? 'null') as Size | null
      const s: Size = savedSize && savedSize.w >= MIN_WIDTH && savedSize.h >= MIN_HEIGHT
        ? savedSize
        : { w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT }
      setSize(s)

      const savedPos = JSON.parse(localStorage.getItem(STORAGE_POS) ?? 'null') as Pos | null
      setPos(clampPos(savedPos ?? defaultPos(s), s))

      const savedMin = localStorage.getItem(STORAGE_MIN)
      setMinimised(savedMin === 'true')
    } catch {
      const s = { w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT }
      setSize(s)
      setPos(defaultPos(s))
    } finally {
      setHydrated(true)
    }
  }, [])

  // Persist on change (skip until after hydration so we don't overwrite
  // saved state with the initial default).
  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(STORAGE_POS, JSON.stringify(pos)) } catch {}
  }, [pos, hydrated])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(STORAGE_SIZE, JSON.stringify(size)) } catch {}
  }, [size, hydrated])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(STORAGE_MIN, String(minimised)) } catch {}
  }, [minimised, hydrated])

  // Keep panel in viewport when the window resizes.
  useEffect(() => {
    function onResize() {
      setPos((p) => clampPos(p, size))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [size])

  // Drag handlers (header). Pointer capture means we keep getting move
  // events even if the cursor leaves the header.
  const onHeaderPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Don't start a drag if the user clicked a button inside the header.
    if (e.target instanceof Element && e.target.closest('button')) return
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [pos.x, pos.y])

  const onHeaderPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return
    const dx = e.clientX - dragStart.current.mx
    const dy = e.clientY - dragStart.current.my
    setPos(clampPos({ x: dragStart.current.px + dx, y: dragStart.current.py + dy }, size))
  }, [size])

  const onHeaderPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragStart.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }, [])

  // Resize handlers (bottom-right corner).
  const onResizePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    resizeStart.current = { mx: e.clientX, my: e.clientY, w: size.w, h: size.h }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [size.w, size.h])

  const onResizePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeStart.current) return
    const dw = e.clientX - resizeStart.current.mx
    const dh = e.clientY - resizeStart.current.my
    const maxW = Math.max(MIN_WIDTH, window.innerWidth - pos.x - MARGIN)
    const maxH = Math.max(MIN_HEIGHT, window.innerHeight - pos.y - MARGIN)
    const w = Math.max(MIN_WIDTH, Math.min(resizeStart.current.w + dw, maxW))
    const h = Math.max(MIN_HEIGHT, Math.min(resizeStart.current.h + dh, maxH))
    setSize({ w, h })
  }, [pos.x, pos.y])

  const onResizePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    resizeStart.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }, [])

  // Close on Escape (matches drawer dismiss convention).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Mobile — slide-up full-screen sheet, no drag chrome.
  if (!isDesktop) {
    return (
      <div
        className={styles.mobileSheet}
        role="dialog"
        aria-label={`Chat with Aisling about ${itemName}`}
      >
        <header className={styles.mobileHeader}>
          <h2 className={styles.mobileTitle}>
            Chat with Aisling
            <span className={styles.mobileSubtitle}>{itemName}</span>
          </h2>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onClose}
            aria-label="Close chat"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className={styles.mobileBody}>
          <PerItemChat
            itemId={itemId}
            itemName={itemName}
            {...(thumbnailUrl ? { thumbnailUrl } : {})}
            {...(onAssessmentUpdated ? { onAssessmentUpdated } : {})}
            chatRefreshTrigger={chatRefreshTrigger}
            isFullscreen={false}
            hideHeader
          />
        </div>
      </div>
    )
  }

  // Desktop — don't render the floating frame until we've read storage,
  // so we never flash at a wrong default position.
  if (!hydrated) return null

  return (
    <div
      className={cn(styles.panel, minimised && styles.panelMinimised)}
      style={{
        left: pos.x,
        top: pos.y,
        width: minimised ? 'auto' : size.w,
        height: minimised ? 'auto' : size.h,
      }}
      role="dialog"
      aria-label={`Chat with Aisling about ${itemName}`}
    >
      <div
        className={styles.header}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
      >
        <GripHorizontal size={14} aria-hidden="true" className={styles.gripIcon} />
        <div className={styles.titleWrap}>
          <span className={styles.titleLabel}>Chat with Aisling</span>
          <span className={styles.titleItem}>{itemName}</span>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setMinimised((m) => !m)}
            aria-label={minimised ? 'Expand chat' : 'Minimise chat'}
            title={minimised ? 'Expand chat' : 'Minimise chat'}
          >
            {minimised ? <Maximize2 size={14} aria-hidden="true" /> : <Minus size={14} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onClose}
            aria-label="Close chat"
            title="Close chat"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {!minimised && (
        <>
          <div className={styles.body}>
            <PerItemChat
              itemId={itemId}
              itemName={itemName}
              {...(thumbnailUrl ? { thumbnailUrl } : {})}
              {...(onAssessmentUpdated ? { onAssessmentUpdated } : {})}
              chatRefreshTrigger={chatRefreshTrigger}
              isFullscreen={false}
              hideHeader
            />
          </div>
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
        </>
      )}
    </div>
  )
}
