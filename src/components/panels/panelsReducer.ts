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
      return mergeRemoteState(state, action.persisted)
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
 * into local state. Merge — never replace — so a write from another device
 * (or a late initial GET) can't silently close panels open here:
 *
 * - remote panels not known locally are added; on a fresh load (no local
 *   panels) they restore as persisted, otherwise they arrive minimised into
 *   the tray (spec §1 cross-device intent),
 * - locally-known panels keep their local geometry, z-order and minimised
 *   state — a remote event never closes or moves them.
 *
 * Returns the same state reference when the remote adds nothing.
 */
export function mergeRemoteState(
  state: PanelsState,
  persisted: PersistedPanelState
): PanelsState {
  const remote = Array.isArray(persisted.panels) ? persisted.panels : []
  const localIds = new Set(state.panels.map((p) => p.id))
  const isFreshLoad = state.panels.length === 0

  let nextZ = state.nextZ
  const added = remote
    .filter((p) => !localIds.has(p.id))
    .map((p) => ({
      ...p,
      zIndex: nextZ++,
      hasUpdate: false,
      minimised: isFreshLoad ? p.minimised : true,
    }))
  if (added.length === 0) return state
  return { panels: [...state.panels, ...added], nextZ }
}
