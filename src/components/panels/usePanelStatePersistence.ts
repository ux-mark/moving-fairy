'use client'

import { useEffect, useMemo, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

import { mergeRemoteState, serialiseState } from './panelsReducer'
import type { PanelsState, PersistedPanelState } from './types'

/** Debounce window for writes — spec §1 says ~1s. */
const WRITE_DEBOUNCE_MS = 1_000

interface PanelStateGetResponse {
  ok: boolean
  state?: PersistedPanelState | Record<string, never>
  updated_at?: string | null
  profileId?: string | null
}

interface PanelStatePatchResponse {
  ok: boolean
  updated_at?: string
}

function isPersistedState(value: unknown): value is PersistedPanelState {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as PersistedPanelState).panels)
  )
}

/**
 * Cross-device panel persistence (spec §1):
 * - hydrate from GET /api/panel-state on load,
 * - debounce (~1s) PATCH writes when the panel set changes,
 * - subscribe to realtime changes on user_panel_state so another device's
 *   panels appear here, with echo suppression (events whose updated_at we
 *   produced ourselves are ignored).
 *
 * Remote state is MERGED, never applied wholesale (mergeRemoteState): panels
 * open here survive remote writes and a late initial GET, and remote-only
 * panels land minimised in the tray. After a merge the synced-JSON marker is
 * set to the merged result so the merge itself doesn't echo a PATCH back
 * (which would resurrect panels the other device just closed).
 */
export function usePanelStatePersistence(
  state: PanelsState,
  hydrate: (persisted: PersistedPanelState) => void
): void {
  const hydratedRef = useRef(false)
  const profileIdRef = useRef<string | null>(null)
  /** updated_at values of our own writes — realtime echoes carry them back. */
  const ownWritesRef = useRef<Set<string>>(new Set())
  /** Last JSON we hydrated from or wrote — skips redundant PATCHes. */
  const lastSyncedJsonRef = useRef<string | null>(null)
  const hydrateRef = useRef(hydrate)
  useEffect(() => {
    hydrateRef.current = hydrate
  }, [hydrate])
  const stateRef = useRef(state)
  stateRef.current = state

  const serialisedJson = useMemo(() => JSON.stringify(serialiseState(state)), [state])

  /** Merge a remote snapshot into local state without triggering an echo write. */
  const applyRemote = (remote: PersistedPanelState) => {
    const merged = mergeRemoteState(stateRef.current, remote)
    const mergedPersisted = serialiseState(merged)
    lastSyncedJsonRef.current = JSON.stringify(mergedPersisted)
    if (merged !== stateRef.current) hydrateRef.current(mergedPersisted)
  }
  const applyRemoteRef = useRef(applyRemote)
  applyRemoteRef.current = applyRemote

  // Hydrate on load. Panels opened while the GET is in flight win — the
  // merge keeps them and trays the rest (late-GET guard).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/panel-state')
        if (!res.ok) return
        const data = (await res.json()) as PanelStateGetResponse
        if (cancelled || !data.ok) return
        profileIdRef.current = data.profileId ?? null
        if (isPersistedState(data.state)) {
          applyRemoteRef.current(data.state)
        }
      } catch {
        // Persistence is an enhancement — panels still work locally.
      } finally {
        if (!cancelled) hydratedRef.current = true
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Debounced write on change (skip until hydrated; skip no-op writes).
  useEffect(() => {
    if (!hydratedRef.current) return
    if (serialisedJson === lastSyncedJsonRef.current) return

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/panel-state', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: `{"state":${serialisedJson}}`,
        })
        if (!res.ok) return
        const data = (await res.json()) as PanelStatePatchResponse
        if (data.ok && data.updated_at) {
          ownWritesRef.current.add(data.updated_at)
        }
        lastSyncedJsonRef.current = serialisedJson
      } catch {
        // Retry happens naturally on the next state change.
      }
    }, WRITE_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [serialisedJson])

  // Realtime: another device wrote — hydrate unless it was our own echo.
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const channel = supabase
      .channel('user_panel_state_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_panel_state' },
        (payload) => {
          const row = payload.new as
            | { user_profile_id?: string; state?: unknown; updated_at?: string }
            | undefined
          if (!row?.updated_at) return
          if (profileIdRef.current && row.user_profile_id !== profileIdRef.current) return
          if (ownWritesRef.current.has(row.updated_at)) {
            ownWritesRef.current.delete(row.updated_at)
            return
          }
          if (isPersistedState(row.state)) {
            applyRemoteRef.current(row.state)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
}
