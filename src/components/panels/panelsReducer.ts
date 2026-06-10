import type { PanelInstance, PanelsAction, PanelsState, PersistedPanelState } from './types'

export const INITIAL_PANELS_STATE: PanelsState = { panels: [], nextZ: 1 }

export function panelId(kind: string, entityId: string): string {
  return `${kind}:${entityId}`
}

function focusPanel(state: PanelsState, id: string): PanelsState {
  const target = state.panels.find((p) => p.id === id)
  if (!target || target.zIndex === state.nextZ - 1) return state
  return {
    nextZ: state.nextZ + 1,
    panels: state.panels.map((p) => (p.id === id ? { ...p, zIndex: state.nextZ } : p)),
  }
}

export function panelsReducer(state: PanelsState, action: PanelsAction): PanelsState {
  switch (action.type) {
    case 'open': {
      const existing = state.panels.find((p) => p.id === action.panel.id)
      if (existing) {
        // Re-open of an already-open entity: restore from tray and focus.
        const restored: PanelsState = {
          ...state,
          panels: state.panels.map((p) =>
            p.id === existing.id ? { ...p, minimised: false, hasUpdate: false } : p
          ),
        }
        return focusPanel(restored, existing.id)
      }
      const panel: PanelInstance = {
        ...action.panel,
        minimised: false,
        zIndex: state.nextZ,
        hasUpdate: false,
      }
      return { nextZ: state.nextZ + 1, panels: [...state.panels, panel] }
    }

    case 'close':
      return { ...state, panels: state.panels.filter((p) => p.id !== action.id) }

    case 'minimise':
      return {
        ...state,
        panels: state.panels.map((p) =>
          p.id === action.id ? { ...p, minimised: true } : p
        ),
      }

    case 'restore': {
      const restored: PanelsState = {
        ...state,
        panels: state.panels.map((p) =>
          p.id === action.id ? { ...p, minimised: false, hasUpdate: false } : p
        ),
      }
      return focusPanel(restored, action.id)
    }

    case 'focus':
      return focusPanel(state, action.id)

    case 'move':
      return {
        ...state,
        panels: state.panels.map((p) => (p.id === action.id ? { ...p, pos: action.pos } : p)),
      }

    case 'resize':
      return {
        ...state,
        panels: state.panels.map((p) =>
          p.id === action.id ? { ...p, size: action.size } : p
        ),
      }

    case 'setTitle':
      return {
        ...state,
        panels: state.panels.map((p) =>
          p.id === action.id ? { ...p, title: action.title } : p
        ),
      }

    case 'markUpdated':
      return {
        ...state,
        panels: state.panels.map((p) =>
          p.id === action.id && p.minimised ? { ...p, hasUpdate: true } : p
        ),
      }

    case 'hydrate':
      return mergeRemoteState(state, action.persisted, action.removeIds)
  }
}

/** Topmost panel that is not minimised — the focus target for Escape. */
export function topPanel(state: PanelsState): PanelInstance | undefined {
  return state.panels
    .filter((p) => !p.minimised)
    .reduce<PanelInstance | undefined>(
      (top, p) => (top === undefined || p.zIndex > top.zIndex ? p : top),
      undefined
    )
}

/** Serialise for user_panel_state.state — z-order kept via array order. */
export function serialiseState(state: PanelsState): PersistedPanelState {
  const ordered = [...state.panels].sort((a, b) => a.zIndex - b.zIndex)
  return {
    panels: ordered.map(({ zIndex: _z, hasUpdate: _u, ...rest }) => rest),
    tray: ordered.filter((p) => p.minimised).map((p) => p.id),
  }
}

/**
 * Merge a remote snapshot (initial GET or another device's realtime write)
 * into local state:
 *
 * - remote panels not known locally are added MINIMISED into the tray —
 *   including on a fresh load. Restores never re-open a pile of windows;
 *   previous work waits one tap away in the tray,
 * - locally-known panels keep their local geometry, z-order and minimised
 *   state — a remote event never moves them,
 * - `removeIds` (panels provably closed on another device — present in the
 *   last state both sides synced, absent from this remote write) propagate
 *   the close: removed outright when minimised here, minimised into the
 *   tray when open here, so a panel mid-use is never yanked away and typed
 *   input survives.
 *
 * Returns the same state reference when nothing changes.
 */
export function mergeRemoteState(
  state: PanelsState,
  persisted: PersistedPanelState,
  removeIds?: ReadonlySet<string> | undefined
): PanelsState {
  const remote = Array.isArray(persisted.panels) ? persisted.panels : []
  const localIds = new Set(state.panels.map((p) => p.id))

  let removedOrTrayed = false
  let panels = state.panels
  if (removeIds && removeIds.size > 0) {
    const next: PanelInstance[] = []
    for (const p of panels) {
      if (!removeIds.has(p.id)) {
        next.push(p)
      } else if (!p.minimised) {
        next.push({ ...p, minimised: true })
        removedOrTrayed = true
      } else {
        removedOrTrayed = true
      }
    }
    panels = next
  }

  let nextZ = state.nextZ
  const added = remote
    .filter((p) => !localIds.has(p.id))
    .map((p) => ({
      ...p,
      zIndex: nextZ++,
      hasUpdate: false,
      minimised: true,
    }))
  if (added.length === 0 && !removedOrTrayed) return state
  return { panels: [...panels, ...added], nextZ }
}
