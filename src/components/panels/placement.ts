import type { PanelPos, PanelSide, PanelSize } from './types'

/** Default floating-window geometry (desktop). Mirrors FloatingChatPanel. */
export const DEFAULT_PANEL_SIZE: PanelSize = { w: 400, h: 560 }
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

/** Which viewport half a trigger element's centre falls in. */
export function originSideFromRect(
  rect: { left: number; right: number },
  viewportWidth: number
): PanelSide {
  const centre = (rect.left + rect.right) / 2
  return centre >= viewportWidth / 2 ? 'right' : 'left'
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
