import { describe, expect, it } from 'vitest'

import {
  INITIAL_PANELS_STATE,
  mergeRemoteState,
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
  it('restores every panel minimised into the tray on a fresh load, keeping geometry', () => {
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

    const restored = mergeRemoteState(INITIAL_PANELS_STATE, persisted)
    expect(restored.panels).toHaveLength(3)
    // A restore never re-opens a pile of windows — everything waits in the tray.
    expect(restored.panels.every((p) => p.minimised)).toBe(true)
    expect(topPanel(restored)).toBeUndefined()
    expect(restored.panels.find((p) => p.id === panelId('listing', 'c'))!.pos).toEqual({
      x: 40,
      y: 80,
    })
  })

  it('hydrates defensively from a malformed payload', () => {
    const restored = mergeRemoteState(INITIAL_PANELS_STATE, {
      panels: undefined,
      tray: [],
    } as never)
    expect(restored.panels).toEqual([])
    expect(restored.nextZ).toBe(1)
  })
})

describe('mergeRemoteState — cross-device merge', () => {
  it('never closes locally-open panels missing from the remote snapshot without proof', () => {
    const local = open(open(INITIAL_PANELS_STATE, 'item', 'a'), 'box', 'b')
    const remote = serialiseState(open(INITIAL_PANELS_STATE, 'item', 'a')) // remote never saw box:b

    const merged = mergeRemoteState(local, remote)

    expect(merged).toBe(local) // nothing added → same reference, no echo write
    expect(merged.panels.map((p) => p.id)).toContain(panelId('box', 'b'))
  })

  it('propagates a proven remote close: minimised panels are removed', () => {
    let local = open(open(INITIAL_PANELS_STATE, 'item', 'a'), 'box', 'b')
    local = panelsReducer(local, { type: 'minimise', id: panelId('box', 'b') })
    const remote = serialiseState(open(INITIAL_PANELS_STATE, 'item', 'a'))

    const merged = mergeRemoteState(local, remote, new Set([panelId('box', 'b')]))

    expect(merged.panels.map((p) => p.id)).not.toContain(panelId('box', 'b'))
    expect(merged.panels.map((p) => p.id)).toContain(panelId('item', 'a'))
  })

  it('propagates a proven remote close: open panels are minimised, not yanked away', () => {
    const local = open(open(INITIAL_PANELS_STATE, 'item', 'a'), 'box', 'b')
    const remote = serialiseState(open(INITIAL_PANELS_STATE, 'item', 'a'))

    const merged = mergeRemoteState(local, remote, new Set([panelId('box', 'b')]))

    const b = merged.panels.find((p) => p.id === panelId('box', 'b'))!
    expect(b.minimised).toBe(true)
  })

  it('adds remote-only panels minimised into the tray when panels are open here', () => {
    const local = open(INITIAL_PANELS_STATE, 'item', 'a')
    const remoteState = open(open(INITIAL_PANELS_STATE, 'item', 'a'), 'listing', 'phone')

    const merged = mergeRemoteState(local, serialiseState(remoteState))

    const added = merged.panels.find((p) => p.id === panelId('listing', 'phone'))!
    expect(added.minimised).toBe(true)
    expect(added.hasUpdate).toBe(false)
  })

  it('keeps local geometry for panels open on this device', () => {
    let local = open(INITIAL_PANELS_STATE, 'item', 'a')
    local = panelsReducer(local, { type: 'move', id: panelId('item', 'a'), pos: { x: 1, y: 2 } })
    let remoteState = open(INITIAL_PANELS_STATE, 'item', 'a')
    remoteState = panelsReducer(remoteState, {
      type: 'move',
      id: panelId('item', 'a'),
      pos: { x: 500, y: 500 },
    })

    const merged = mergeRemoteState(local, serialiseState(remoteState))

    expect(merged.panels[0]!.pos).toEqual({ x: 1, y: 2 })
  })

  it('guards a late initial GET: panels opened during load survive, rest go to the tray', () => {
    const openedDuringLoad = open(INITIAL_PANELS_STATE, 'item', 'fresh')
    const persistedState = open(INITIAL_PANELS_STATE, 'box', 'old') // open on the server snapshot

    const merged = mergeRemoteState(openedDuringLoad, serialiseState(persistedState))

    const fresh = merged.panels.find((p) => p.id === panelId('item', 'fresh'))!
    const old = merged.panels.find((p) => p.id === panelId('box', 'old'))!
    expect(fresh.minimised).toBe(false)
    expect(old.minimised).toBe(true)
  })

  it('is idempotent — re-applying the merged snapshot adds nothing', () => {
    const local = open(INITIAL_PANELS_STATE, 'item', 'a')
    const remote = serialiseState(open(INITIAL_PANELS_STATE, 'listing', 'p'))

    const merged = mergeRemoteState(local, remote)
    const again = mergeRemoteState(merged, serialiseState(merged))

    expect(again).toBe(merged)
  })
})
