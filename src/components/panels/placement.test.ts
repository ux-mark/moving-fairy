import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PANEL_SIZE,
  TOP_GUARD,
  VIEWPORT_MARGIN,
  clampPos,
  defaultPanelPos,
  originSideFromRect,
  resolveDockSide,
} from './placement'

const VIEWPORT = { w: 1440, h: 900 }

describe('resolveDockSide', () => {
  it('docks right by default', () => {
    expect(resolveDockSide(undefined)).toBe('right')
  })

  it('docks right when the request originates on the left', () => {
    expect(resolveDockSide('left')).toBe('right')
  })

  it('opens left when the request originates from the right (edge case)', () => {
    expect(resolveDockSide('right')).toBe('left')
  })
})

describe('originSideFromRect', () => {
  it('detects a trigger in the left half', () => {
    expect(originSideFromRect({ left: 100, right: 200 }, VIEWPORT.w)).toBe('left')
  })

  it('detects a trigger in the right half', () => {
    expect(originSideFromRect({ left: 1200, right: 1300 }, VIEWPORT.w)).toBe('right')
  })

  it('uses the centre of the rect, not its edges', () => {
    // Spans the midline but the centre sits just right of it.
    expect(originSideFromRect({ left: 700, right: 760 }, VIEWPORT.w)).toBe('right')
  })
})

describe('defaultPanelPos', () => {
  it('docks a right panel against the right edge', () => {
    const pos = defaultPanelPos('right', DEFAULT_PANEL_SIZE, VIEWPORT)
    expect(pos.x).toBe(VIEWPORT.w - DEFAULT_PANEL_SIZE.w - VIEWPORT_MARGIN)
  })

  it('docks a left panel against the left margin', () => {
    const pos = defaultPanelPos('left', DEFAULT_PANEL_SIZE, VIEWPORT)
    expect(pos.x).toBe(VIEWPORT_MARGIN)
  })

  it('never positions a panel under the nav', () => {
    const pos = defaultPanelPos('right', { w: 400, h: 5000 }, VIEWPORT)
    expect(pos.y).toBeGreaterThanOrEqual(TOP_GUARD)
  })

  it('cascades subsequent panels on the same side down-and-in', () => {
    const first = defaultPanelPos('right', DEFAULT_PANEL_SIZE, VIEWPORT, 0)
    const second = defaultPanelPos('right', DEFAULT_PANEL_SIZE, VIEWPORT, 1)
    expect(second.x).toBeLessThan(first.x)
    expect(second.y).toBeGreaterThan(first.y)
  })
})

describe('clampPos', () => {
  it('clamps a stale off-screen position back into the viewport', () => {
    const pos = clampPos({ x: 99999, y: 99999 }, DEFAULT_PANEL_SIZE, VIEWPORT)
    expect(pos.x).toBe(VIEWPORT.w - DEFAULT_PANEL_SIZE.w - VIEWPORT_MARGIN)
    expect(pos.y).toBe(VIEWPORT.h - DEFAULT_PANEL_SIZE.h - VIEWPORT_MARGIN)
  })

  it('clamps negative positions to the margins below the nav', () => {
    const pos = clampPos({ x: -50, y: -50 }, DEFAULT_PANEL_SIZE, VIEWPORT)
    expect(pos.x).toBe(VIEWPORT_MARGIN)
    expect(pos.y).toBe(TOP_GUARD)
  })
})
