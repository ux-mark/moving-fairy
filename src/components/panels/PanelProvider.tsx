'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'

import { Panel } from './Panel'
import { PanelTray } from './PanelTray'
import {
  INITIAL_PANELS_STATE,
  panelId,
  panelsReducer,
  topPanel,
} from './panelsReducer'
import { resolveDockSide } from './placement'
import { getPanelContent } from './registry'
import type {
  OpenPanelOptions,
  PanelInstance,
  PanelPos,
  PanelSize,
  PersistedPanelState,
} from './types'
import { usePanelStatePersistence } from './usePanelStatePersistence'
import styles from './PanelProvider.module.css'

interface PanelsContextValue {
  panels: PanelInstance[]
  /** Opens (or restores + focuses) a panel; returns its id. */
  openPanel: (options: OpenPanelOptions) => string
  closePanel: (id: string) => void
  minimisePanel: (id: string) => void
  restorePanel: (id: string) => void
  focusPanel: (id: string) => void
  /** Phase C: entity panels set their real title once data loads. */
  setPanelTitle: (id: string, title: string) => void
  /** Phase C: live hooks flag background changes on minimised panels. */
  markPanelUpdated: (id: string) => void
}

const PanelsContext = createContext<PanelsContextValue | null>(null)

export function usePanels(): PanelsContextValue {
  const ctx = useContext(PanelsContext)
  if (!ctx) throw new Error('usePanels must be used inside PanelProvider')
  return ctx
}

/** Fallback header titles until Phase C panels set entity names. */
const KIND_TITLES: Record<OpenPanelOptions['kind'], string> = {
  item: 'Item',
  box: 'Box',
  listing: 'Listing',
  chat: 'Chat',
}

interface PanelProviderProps {
  children: ReactNode
  /**
   * Render the default tray dock (floating, top-right on desktop / above the
   * bottom edge on mobile). Phase E sets this false and mounts <PanelTray />
   * directly above the bottom nav instead.
   */
  renderTray?: boolean | undefined
}

/**
 * Panel system context (spec §1). Owns the set of open panels, z-order,
 * Escape handling with focus return, cross-device persistence, and renders
 * the floating windows + tray. Mounted once in the (app) layout.
 */
export function PanelProvider({ children, renderTray = true }: PanelProviderProps) {
  const [state, dispatch] = useReducer(panelsReducer, INITIAL_PANELS_STATE)
  /** Trigger element per panel id — Escape/close returns focus there. */
  const triggersRef = useRef<Map<string, HTMLElement>>(new Map())

  const hydrate = useCallback((persisted: PersistedPanelState) => {
    dispatch({ type: 'hydrate', persisted })
  }, [])
  usePanelStatePersistence(state, hydrate)

  const openPanel = useCallback((options: OpenPanelOptions): string => {
    const id = panelId(options.kind, options.entityId)
    if (document.activeElement instanceof HTMLElement) {
      triggersRef.current.set(id, document.activeElement)
    }
    dispatch({
      type: 'open',
      panel: {
        id,
        kind: options.kind,
        entityId: options.entityId,
        title: options.title ?? KIND_TITLES[options.kind],
        side: resolveDockSide(options.originSide),
      },
    })
    return id
  }, [])

  const closePanel = useCallback((id: string) => {
    dispatch({ type: 'close', id })
    const trigger = triggersRef.current.get(id)
    triggersRef.current.delete(id)
    if (trigger?.isConnected) trigger.focus()
  }, [])

  const minimisePanel = useCallback((id: string) => dispatch({ type: 'minimise', id }), [])
  const restorePanel = useCallback((id: string) => dispatch({ type: 'restore', id }), [])
  const focusPanel = useCallback((id: string) => dispatch({ type: 'focus', id }), [])
  const setPanelTitle = useCallback(
    (id: string, title: string) => dispatch({ type: 'setTitle', id, title }),
    []
  )
  const markPanelUpdated = useCallback((id: string) => dispatch({ type: 'markUpdated', id }), [])

  // Escape closes the focused (topmost) panel and returns focus to its trigger.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const top = topPanel(stateRef.current)
      if (!top) return
      e.stopPropagation()
      closePanel(top.id)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closePanel])

  const value = useMemo<PanelsContextValue>(
    () => ({
      panels: state.panels,
      openPanel,
      closePanel,
      minimisePanel,
      restorePanel,
      focusPanel,
      setPanelTitle,
      markPanelUpdated,
    }),
    [
      state.panels,
      openPanel,
      closePanel,
      minimisePanel,
      restorePanel,
      focusPanel,
      setPanelTitle,
      markPanelUpdated,
    ]
  )

  const visible = state.panels.filter((p) => !p.minimised)

  return (
    <PanelsContext.Provider value={value}>
      {children}
      {visible.map((panel) => {
        const Content = getPanelContent(panel.kind)
        const indexOnSide = visible
          .filter((p) => p.side === panel.side)
          .findIndex((p) => p.id === panel.id)
        return (
          <Panel
            key={panel.id}
            panel={panel}
            indexOnSide={Math.max(0, indexOnSide)}
            onClose={() => closePanel(panel.id)}
            onMinimise={() => minimisePanel(panel.id)}
            onFocus={() => focusPanel(panel.id)}
            onMove={(pos: PanelPos) => dispatch({ type: 'move', id: panel.id, pos })}
            onResize={(size: PanelSize) => dispatch({ type: 'resize', id: panel.id, size })}
          >
            <Content panelId={panel.id} entityId={panel.entityId} />
          </Panel>
        )
      })}
      {renderTray && state.panels.length > 0 && (
        <div className={styles.trayDock}>
          <PanelTray />
        </div>
      )}
    </PanelsContext.Provider>
  )
}
