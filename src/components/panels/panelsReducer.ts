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
      return hydrateState(action.persisted)
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

export function hydrateState(persisted: PersistedPanelState): PanelsState {
  const panels = Array.isArray(persisted.panels) ? persisted.panels : []
  return {
    panels: panels.map((p, i) => ({ ...p, zIndex: i + 1, hasUpdate: false })),
    nextZ: panels.length + 1,
  }
}
