import type { PanelKind, PanelPos, PanelSide, PanelSize } from './types'

/** Default floating-window geometry (desktop). Mirrors FloatingChatPanel. */
export const DEFAULT_PANEL_SIZE: PanelSize = { w: 400, h: 560 }
/** Entity panels (item/box/listing) default wider than the chat window. */
const ENTITY_PANEL_WIDTH = 480
export const MIN_PANEL_WIDTH = 320
export const MIN_PANEL_HEIGHT = 320
export const VIEWPORT_MARGIN = 16
/**
 * DS Navigation is 56px tall (sticky, --z-sticky-nav). Panels must never sit
 * under it, so y is clamped below the nav plus a breathing margin.
 */
export const NAV_HEIGHT = 56
export const TOP_GUARD = NAV_HEIGHT + VIEWPORT_MARGIN
/** Each additional panel on the same side steps down-and-in by this much. */
const CASCADE_STEP = 32
/**
 * Panels float above ALL chrome — DS sticky nav is --z-sticky-nav: 100 and
 * FloatingChatPanel established 110 as the floating-tool layer. The provider's
 * per-panel z counter is added on top of this base.
 */
export const PANEL_Z_BASE = 110

/**
 * Smart dock side (spec §1): default is right; a request originating from the
 * right half (inside a right-docked panel, or a trigger whose centre sits in
 * the right half while a right panel is focused) docks the new panel left so
 * it doesn't bury what the user is looking at.
 */
export function resolveDockSide(originSide?: PanelSide | undefined): PanelSide {
  return originSide === 'right' ? 'left' : 'right'
}

/**
 * Per-kind default size for a panel that has never been resized. Entity
 * panels (item, box, listing) take the full height available below the nav —
 * they're form-heavy workspaces, not pop-ups. Chat keeps the compact
 * floating-window default. Still user-resizable either way.
 */
export function defaultPanelSize(
  kind: PanelKind,
  viewport: { w: number; h: number }
): PanelSize {
  if (kind === 'chat') return DEFAULT_PANEL_SIZE
  return {
    w: Math.max(
      MIN_PANEL_WIDTH,
      Math.min(ENTITY_PANEL_WIDTH, viewport.w - VIEWPORT_MARGIN * 2)
    ),
    h: Math.max(MIN_PANEL_HEIGHT, viewport.h - TOP_GUARD - VIEWPORT_MARGIN),
  }
}

/** Which viewport half a trigger element's centre falls in. */
export function originSideFromRect(
  rect: { left: number; right: number },
  viewportWidth: number
): PanelSide {
  const centre = (rect.left + rect.right) / 2
  return centre >= viewportWidth / 2 ? 'right' : 'left'
}

// Last pointer-down x — fallback for browsers (Safari) that don't move focus
// to a clicked button, where document.activeElement stays on <body>.
let lastPointerX: number | null = null
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    (e) => {
      lastPointerX = e.clientX
    },
    { capture: true, passive: true }
  )
}

/**
 * Origin side of the interaction that is about to open a panel. Reads the
 * focused element's rect (keyboard activation and most pointer clicks), and
 * falls back to the last pointer-down position. Call synchronously from the
 * click handler, before openPanel.
 */
export function originSideFromTrigger(): PanelSide | undefined {
  if (typeof window === 'undefined') return undefined
  const el = document.activeElement
  if (el instanceof HTMLElement && el !== document.body) {
    return originSideFromRect(el.getBoundingClientRect(), window.innerWidth)
  }
  if (lastPointerX !== null) {
    return lastPointerX >= window.innerWidth / 2 ? 'right' : 'left'
  }
  return undefined
}

export function clampPos(
  pos: PanelPos,
  size: PanelSize,
  viewport: { w: number; h: number }
): PanelPos {
  return {
    x: Math.max(
      VIEWPORT_MARGIN,
      Math.min(pos.x, Math.max(VIEWPORT_MARGIN, viewport.w - size.w - VIEWPORT_MARGIN))
    ),
    y: Math.max(
      TOP_GUARD,
      Math.min(pos.y, Math.max(TOP_GUARD, viewport.h - size.h - VIEWPORT_MARGIN))
    ),
  }
}

/**
 * Default position for a panel that has never been dragged: docked to its
 * side, vertically centred in the space below the nav, cascaded down-and-in
 * when other panels already occupy that side.
 */
export function defaultPanelPos(
  side: PanelSide,
  size: PanelSize,
  viewport: { w: number; h: number },
  indexOnSide = 0
): PanelPos {
  const offset = indexOnSide * CASCADE_STEP
  const x =
    side === 'right' ? viewport.w - size.w - VIEWPORT_MARGIN - offset : VIEWPORT_MARGIN + offset
  const availableHeight = Math.max(size.h, viewport.h - TOP_GUARD)
  const y = TOP_GUARD + Math.round((availableHeight - size.h) / 2) + offset
  return clampPos({ x, y }, size, viewport)
}
