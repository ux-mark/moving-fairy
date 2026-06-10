import { describe, expect, it } from 'vitest'

import {
  INITIAL_PANELS_STATE,
  hydrateState,
  panelId,
  panelsReducer,
  serialiseState,
  topPanel,
} from './panelsReducer'
import { resolveDockSide } from './placement'
import type { PanelsState, PanelSide } from './types'

function open(
  state: PanelsState,
  kind: 'item' | 'box' | 'listing' | 'chat',
  entityId: string,
  originSide?: PanelSide
): PanelsState {
  return panelsReducer(state, {
    type: 'open',
    panel: {
      id: panelId(kind, entityId),
      kind,
      entityId,
      title: entityId,
      side: resolveDockSide(originSide),
    },
  })
}

describe('panelsReducer — open', () => {
  it('opens a panel docked right by default', () => {
    const state = open(INITIAL_PANELS_STATE, 'item', 'a')
    expect(state.panels).toHaveLength(1)
    expect(state.panels[0]!.side).toBe('right')
    expect(state.panels[0]!.minimised).toBe(false)
  })

  it('opens left when the request originates from a right-docked panel (edge case)', () => {
    let state = open(INITIAL_PANELS_STATE, 'item', 'a')
    state = open(state, 'chat', 'a', state.panels[0]!.side)
    expect(state.panels[1]!.side).toBe('left')
  })

  it('focuses and restores instead of duplicating an already-open entity', () => {
    let state = open(INITIAL_PANELS_STATE, 'item', 'a')
    state = open(state, 'item', 'b')
    state = panelsReducer(state, { type: 'minimise', id: panelId('item', 'a') })

    state = open(state, 'item', 'a')

    expect(state.panels).toHaveLength(2)
    const a = state.panels.find((p) => p.id === panelId('item', 'a'))!
    expect(a.minimised).toBe(false)
    expect(topPanel(state)!.id).toBe(a.id)
  })
})

describe('panelsReducer — z-order and focus', () => {
  it('gives each new panel the top z', () => {
    let state = open(INITIAL_PANELS_STATE, 'item', 'a')
    state = open(state, 'box', 'b')
    expect(topPanel(state)!.id).toBe(panelId('box', 'b'))
  })

  it('raises a panel on focus', () => {
    let state = open(INITIAL_PANELS_STATE, 'item', 'a')
    state = open(state, 'box', 'b')
    state = panelsReducer(state, { type: 'focus', id: panelId('item', 'a') })
    expect(topPanel(state)!.id).toBe(panelId('item', 'a'))
  })

  it('focus on the already-top panel is a no-op (no z churn for persistence)', () => {
    let state = open(INITIAL_PANELS_STATE, 'item', 'a')
    const before = state
    state = panelsReducer(state, { type: 'focus', id: panelId('item', 'a') })
    expect(state).toBe(before)
  })

  it('skips minimised panels when finding the Escape target', () => {
    let state = open(INITIAL_PANELS_STATE, 'item', 'a')
    state = open(state, 'box', 'b')
    state = panelsReducer(state, { type: 'minimise', id: panelId('box', 'b') })
    expect(topPanel(state)!.id).toBe(panelId('item', 'a'))
  })
})

describe('panelsReducer — close / minimise / restore', () => {
  it('close removes the panel', () => {
    let state = open(INITIAL_PANELS_STATE, 'item', 'a')
    state = panelsReducer(state, { type: 'close', id: panelId('item', 'a') })
    expect(state.panels).toHaveLength(0)
  })

  it('restore clears the live-update flag and focuses', () => {
    let state = open(INITIAL_PANELS_STATE, 'item', 'a')
    state = open(state, 'box', 'b')
    state = panelsReducer(state, { type: 'minimise', id: panelId('item', 'a') })
    state = panelsReducer(state, { type: 'markUpdated', id: panelId('item', 'a') })
    expect(state.panels.find((p) => p.id === panelId('item', 'a'))!.hasUpdate).toBe(true)

    state = panelsReducer(state, { type: 'restore', id: panelId('item', 'a') })
    const a = state.panels.find((p) => p.id === panelId('item', 'a'))!
    expect(a.minimised).toBe(false)
    expect(a.hasUpdate).toBe(false)
    expect(topPanel(state)!.id).toBe(a.id)
  })

  it('markUpdated only flags minimised panels', () => {
    const state = open(INITIAL_PANELS_STATE, 'item', 'a')
    const next = panelsReducer(state, { type: 'markUpdated', id: panelId('item', 'a') })
    expect(next.panels[0]!.hasUpdate).toBe(false)
  })
})

describe('serialise / hydrate round-trip', () => {
  it('preserves panels, tray membership and z-order', () => {
    let state = open(INITIAL_PANELS_STATE, 'item', 'a')
    state = open(state, 'box', 'b')
    state = open(state, 'listing', 'c')
    state = panelsReducer(state, { type: 'minimise', id: panelId('box', 'b') })
    state = panelsReducer(state, { type: 'focus', id: panelId('item', 'a') })
    state = panelsReducer(state, {
      type: 'move',
      id: panelId('listing', 'c'),
      pos: { x: 40, y: 80 },
    })

    const persisted = serialiseState(state)
    expect(persisted.tray).toEqual([panelId('box', 'b')])

    const restored = hydrateState(persisted)
    expect(restored.panels).toHaveLength(3)
    expect(topPanel(restored)!.id).toBe(panelId('item', 'a'))
    expect(restored.panels.find((p) => p.id === panelId('box', 'b'))!.minimised).toBe(true)
    expect(restored.panels.find((p) => p.id === panelId('listing', 'c'))!.pos).toEqual({
      x: 40,
      y: 80,
    })
  })

  it('hydrates defensively from a malformed payload', () => {
    const restored = hydrateState({ panels: undefined, tray: [] } as never)
    expect(restored.panels).toEqual([])
    expect(restored.nextZ).toBe(1)
  })
})
