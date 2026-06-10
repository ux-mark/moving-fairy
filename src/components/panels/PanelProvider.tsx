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

import {
  useLiveTableEvents,
  type LiveRow,
  type LiveTableEvent,
} from '@/lib/hooks/useLiveTable'
import { useProfileId } from '@/lib/hooks/useProfileId'

import { hasOpenModalLayer } from './modalLayer'
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
// Side effect: registers the entity panel content components (lazy-loaded).
import './registerContent'

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

  const hydrate = useCallback(
    (persisted: PersistedPanelState, removeIds?: ReadonlySet<string>) => {
      dispatch({ type: 'hydrate', persisted, removeIds })
    },
    []
  )
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
      // A modal layer (ConfirmDialog, VerdictPicker, …) owns Escape while it's
      // open — closing the panel underneath would discard unsaved form input.
      if (hasOpenModalLayer()) return
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
      <MinimisedPanelWatcher panels={state.panels} markPanelUpdated={markPanelUpdated} />
      {renderTray && state.panels.length > 0 && (
        <div className={styles.trayDock}>
          <PanelTray />
        </div>
      )}
    </PanelsContext.Provider>
  )
}

/**
 * Live dot for tray chips (spec §1): minimised panel content is unmounted, so
 * its own live hooks can't see background changes. This watcher subscribes to
 * the entity tables only while minimised panels of that kind exist, and flags
 * the matching panel via markPanelUpdated (cleared by restore/open). Filters
 * mirror the existing hooks' channels (items filtered by profile, box/listing
 * unfiltered) so it joins their shared channel instead of opening a new one.
 * Chat panels are fetch-based (no realtime table) and refetch on restore.
 */
function MinimisedPanelWatcher({
  panels,
  markPanelUpdated,
}: {
  panels: PanelInstance[]
  markPanelUpdated: (id: string) => void
}) {
  const profileId = useProfileId()
  const panelsRef = useRef(panels)
  useEffect(() => {
    panelsRef.current = panels
  }, [panels])

  const flag = useCallback(
    (kinds: PanelInstance['kind'][], event: LiveTableEvent<LiveRow>) => {
      const entityId = event.new?.id ?? event.old?.id
      if (!entityId) return
      for (const p of panelsRef.current) {
        if (p.minimised && p.entityId === entityId && kinds.includes(p.kind)) {
          markPanelUpdated(p.id)
        }
      }
    },
    [markPanelUpdated]
  )
  // An item change also flags its chat panel (saves inject a system message).
  const onItem = useCallback((e: LiveTableEvent<LiveRow>) => flag(['item', 'chat'], e), [flag])
  const onBox = useCallback((e: LiveTableEvent<LiveRow>) => flag(['box'], e), [flag])
  const onListing = useCallback((e: LiveTableEvent<LiveRow>) => flag(['listing'], e), [flag])

  const hasMinimised = (kind: PanelInstance['kind']) =>
    panels.some((p) => p.kind === kind && p.minimised)

  useLiveTableEvents(
    'item_assessment',
    profileId ? `user_profile_id=eq.${profileId}` : undefined,
    onItem,
    hasMinimised('item') || hasMinimised('chat')
  )
  useLiveTableEvents('box', undefined, onBox, hasMinimised('box'))
  useLiveTableEvents('listing', undefined, onListing, hasMinimised('listing'))

  return null
}
