'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LiveRow {
  id: string
}

export interface LiveTableEvent<T extends LiveRow> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  /** Full row for INSERT/UPDATE, null for DELETE. */
  new: T | null
  /** Old tuple (full row — tables use replica identity full), null for INSERT. */
  old: (Partial<T> & { id?: string }) | null
}

// ---------------------------------------------------------------------------
// Pure merge logic (unit-tested in useLiveTable.test.ts)
// ---------------------------------------------------------------------------

/**
 * Merge a realtime event into a local row array.
 *
 * - INSERT of an already-present id (echo of an optimistic add) shallow-merges
 *   into the existing row so derived/joined fields survive.
 * - UPDATE of a missing id (missed INSERT) adopts the row.
 * - DELETE of a missing id is a no-op and returns the same array reference.
 */
export function mergeLiveEvent<T extends LiveRow>(
  rows: T[],
  event: LiveTableEvent<T>,
  sort?: ((a: T, b: T) => number) | undefined
): T[] {
  if (event.eventType === 'DELETE') {
    const id = event.old?.id
    if (!id || !rows.some((r) => r.id === id)) return rows
    return rows.filter((r) => r.id !== id)
  }

  const incoming = event.new
  if (!incoming) return rows

  const exists = rows.some((r) => r.id === incoming.id)
  const next = exists
    ? rows.map((r) => (r.id === incoming.id ? { ...r, ...incoming } : r))
    : [...rows, incoming]
  return sort ? next.sort(sort) : next
}

// ---------------------------------------------------------------------------
// Consolidated channel registry — one channel per table per filter, shared by
// every hook instance. supabase-js rejoins channels automatically when the
// socket reconnects; the registry just makes sure we never open duplicates.
// ---------------------------------------------------------------------------

type RawHandler = (
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>
) => void

interface ChannelEntry {
  channel: RealtimeChannel
  handlers: Set<RawHandler>
  /** Pending deferred teardown — cancelled if a subscriber returns in time. */
  teardownTimer: ReturnType<typeof setTimeout> | null
}

const channelRegistry = new Map<string, ChannelEntry>()
let sharedClient: SupabaseClient | null = null

/**
 * Teardown grace: when the last handler unsubscribes, keep the channel alive
 * briefly so a quick remount (StrictMode, route transitions) reuses the
 * existing entry instead of racing a removeChannel against a fresh channel
 * with the same topic.
 */
const CHANNEL_TEARDOWN_GRACE_MS = 250

function getClient(): SupabaseClient {
  if (!sharedClient) sharedClient = createClient()
  return sharedClient
}

/**
 * Subscribe to postgres_changes for a table (optionally filtered, e.g.
 * `user_profile_id=eq.<id>`). Returns an unsubscribe function. Subscriptions
 * with the same table+filter share a single channel.
 */
export function subscribeToTableChanges(
  table: string,
  filter: string | undefined,
  handler: RawHandler
): () => void {
  const key = `${table}|${filter ?? ''}`
  let entry = channelRegistry.get(key)
  if (entry?.teardownTimer) {
    // Re-subscribed during the grace window — reuse the live channel.
    clearTimeout(entry.teardownTimer)
    entry.teardownTimer = null
  }
  if (!entry) {
    const channel = getClient()
      .channel(`live:${key}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
        (payload) => {
          const current = channelRegistry.get(key)
          if (!current) return
          for (const h of current.handlers) h(payload)
        }
      )
      .subscribe()
    entry = { channel, handlers: new Set(), teardownTimer: null }
    channelRegistry.set(key, entry)
  }
  entry.handlers.add(handler)

  return () => {
    const current = channelRegistry.get(key)
    if (!current) return
    current.handlers.delete(handler)
    if (current.handlers.size === 0 && !current.teardownTimer) {
      current.teardownTimer = setTimeout(() => {
        current.teardownTimer = null
        if (current.handlers.size > 0) return
        channelRegistry.delete(key)
        void getClient().removeChannel(current.channel)
      }, CHANNEL_TEARDOWN_GRACE_MS)
    }
  }
}

function toLiveEvent<T extends LiveRow>(
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>
): LiveTableEvent<T> {
  return {
    eventType: payload.eventType,
    new: payload.eventType === 'DELETE' ? null : (payload.new as T),
    old: payload.eventType === 'INSERT' ? null : (payload.old as Partial<T> & { id?: string }),
  }
}

// ---------------------------------------------------------------------------
// useLiveTableEvents — low-level: run a callback for every change on a table.
// For consumers that keep their own derived state shape (e.g. BoxManagement's
// boxItems record) and can't adopt useLiveTable's flat row array.
// ---------------------------------------------------------------------------

export function useLiveTableEvents<T extends LiveRow>(
  table: string,
  filter: string | undefined,
  onEvent: (event: LiveTableEvent<T>) => void,
  enabled = true
): void {
  const handlerRef = useRef(onEvent)
  useEffect(() => {
    handlerRef.current = onEvent
  })

  useEffect(() => {
    if (!enabled) return
    return subscribeToTableChanges(table, filter, (payload) => {
      handlerRef.current(toLiveEvent<T>(payload))
    })
  }, [table, filter, enabled])
}

// ---------------------------------------------------------------------------
// useRevalidateOnFocus — refetch when the tab regains focus/visibility or the
// network comes back. Covers realtime events missed while hidden/offline.
// ---------------------------------------------------------------------------

export function useRevalidateOnFocus(refresh: () => void, enabled = true): void {
  const refreshRef = useRef(refresh)
  useEffect(() => {
    refreshRef.current = refresh
  })

  useEffect(() => {
    if (!enabled) return
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshRef.current()
    }
    const onFocusOrOnline = () => refreshRef.current()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocusOrOnline)
    window.addEventListener('online', onFocusOrOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onFocusOrOnline)
      window.removeEventListener('online', onFocusOrOnline)
    }
  }, [enabled])
}

// ---------------------------------------------------------------------------
// useLiveTable — fetch + live subscription for one table's rows.
// ---------------------------------------------------------------------------

export interface UseLiveTableOptions<T extends LiveRow> {
  table: string
  /** Realtime filter, e.g. `user_profile_id=eq.<id>`. Omit to rely on RLS. */
  filter?: string | undefined
  /** Full (re)fetch of the row set — usually an existing API route. */
  fetcher: () => Promise<T[]>
  /** Seed rows (e.g. server-rendered props) — skips the initial fetch. */
  initial?: T[] | undefined
  sort?: ((a: T, b: T) => number) | undefined
  /**
   * Events on these related tables trigger a debounced refetch — for row
   * shapes with joined/derived data the event payload can't carry
   * (e.g. box.items comes from box_item).
   */
  refetchOnTables?: string[] | undefined
  enabled?: boolean | undefined
}

export interface UseLiveTableReturn<T extends LiveRow> {
  rows: T[]
  /** Direct state access for optimistic updates — realtime echoes dedupe by id. */
  setRows: Dispatch<SetStateAction<T[]>>
  isLoading: boolean
  error: string | null
  /** Refetch now. Resolves with the fresh rows, or null on failure. */
  refresh: () => Promise<T[] | null>
}

const REFETCH_DEBOUNCE_MS = 400

export function useLiveTable<T extends LiveRow>(
  options: UseLiveTableOptions<T>
): UseLiveTableReturn<T> {
  const { table, filter, initial, enabled = true } = options
  const [rows, setRows] = useState<T[]>(initial ?? [])
  const [isLoading, setIsLoading] = useState(enabled && !initial)
  const [error, setError] = useState<string | null>(null)

  const fetcherRef = useRef(options.fetcher)
  const sortRef = useRef(options.sort)
  useEffect(() => {
    fetcherRef.current = options.fetcher
    sortRef.current = options.sort
  })
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Monotonic token — a refresh started later always wins; a slow fetch that
  // resolves after a newer one is ignored instead of clobbering fresher rows.
  const refreshTokenRef = useRef(0)
  const refresh = useCallback(async (): Promise<T[] | null> => {
    const token = ++refreshTokenRef.current
    try {
      const fetched = await fetcherRef.current()
      const sorted = sortRef.current ? [...fetched].sort(sortRef.current) : fetched
      if (isMountedRef.current && token === refreshTokenRef.current) {
        setRows(sorted)
        setError(null)
      }
      return sorted
    } catch (err) {
      if (isMountedRef.current && token === refreshTokenRef.current) {
        setError(err instanceof Error ? err.message : `Failed to load ${table}`)
      }
      return null
    }
  }, [table])

  // Initial fetch (skipped when seeded with server-rendered rows).
  const hasInitial = initial !== undefined
  useEffect(() => {
    if (!enabled || hasInitial) return
    // isLoading initialises to true for this case; just clear it when done.
    // Deferred a tick so no state updates happen synchronously in the effect.
    const timer = setTimeout(() => {
      void refresh().finally(() => {
        if (isMountedRef.current) setIsLoading(false)
      })
    }, 0)
    return () => clearTimeout(timer)
  }, [enabled, hasInitial, refresh])

  // Debounced refetch — used to enrich adopted rows (joined fields the event
  // payload can't carry) and for related-table events.
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRefresh = useCallback(() => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
    refetchTimerRef.current = setTimeout(() => {
      refetchTimerRef.current = null
      void refresh()
    }, REFETCH_DEBOUNCE_MS)
  }, [refresh])
  useEffect(() => {
    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
    }
  }, [])

  // Live subscription on the table itself.
  useEffect(() => {
    if (!enabled) return
    return subscribeToTableChanges(table, filter, (payload) => {
      if (!isMountedRef.current) return
      const event = toLiveEvent<T>(payload)
      let adopted = false
      setRows((prev) => {
        if (
          event.eventType !== 'DELETE' &&
          event.new &&
          !prev.some((r) => r.id === event.new!.id)
        ) {
          adopted = true
        }
        return mergeLiveEvent(prev, event, sortRef.current)
      })
      // A row we'd never seen arrived bare from the WAL — refetch to pick up
      // any joined fields the fetcher would have included.
      if (adopted) scheduleRefresh()
    })
  }, [enabled, table, filter, scheduleRefresh])

  // Related-table subscriptions → debounced refetch.
  const refetchTablesKey = options.refetchOnTables?.join(',') ?? ''
  useEffect(() => {
    if (!enabled || !refetchTablesKey) return
    const unsubscribes = refetchTablesKey
      .split(',')
      .map((related) => subscribeToTableChanges(related, undefined, scheduleRefresh))
    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe()
    }
  }, [enabled, refetchTablesKey, scheduleRefresh])

  // Focus / visibility / reconnect revalidation.
  useRevalidateOnFocus(() => void refresh(), enabled)

  return { rows, setRows, isLoading, error, refresh }
}
