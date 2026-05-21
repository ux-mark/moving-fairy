'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

/**
 * Public buyer bundle state, persisted in localStorage and synced across
 * components in the same tab via a custom event. Keyed by listing UUID so
 * the same selection survives between the collection root and detail page.
 *
 * Storage shape: `string[]` of listing IDs (UUIDs).
 *
 * `useSyncExternalStore` is the React 19 way to subscribe to a non-React
 * source. It avoids the lint warning about setState-in-effect *and* gives us
 * a clean SSR snapshot (empty array) so the first paint matches the server
 * and there's no hydration mismatch.
 */
const STORAGE_KEY = 'salefairy.bundle'
const EVENT_NAME = 'salefairy:bundle-change'
const EMPTY: readonly string[] = Object.freeze([])

function readBundle(): readonly string[] {
  if (typeof window === 'undefined') return EMPTY
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return EMPTY
    const filtered = parsed.filter((v): v is string => typeof v === 'string')
    return filtered.length === 0 ? EMPTY : filtered
  } catch {
    return EMPTY
  }
}

function writeBundle(ids: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    /* quota exceeded or storage disabled — selection just won't persist */
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: ids }))
}

// Cache the last snapshot to keep `useSyncExternalStore`'s identity check
// stable when nothing has changed.
let cached: readonly string[] = EMPTY
let cacheVersion = 0

function getSnapshot(): readonly string[] {
  // Re-read on each call but reuse the cached reference when the contents
  // haven't changed — useSyncExternalStore demands a stable identity for
  // unchanged data.
  const current = readBundle()
  if (
    current.length === cached.length &&
    current.every((v, i) => v === cached[i])
  ) {
    return cached
  }
  cacheVersion += 1
  cached = current
  return cached
}

function getServerSnapshot(): readonly string[] {
  return EMPTY
}

function subscribe(notify: () => void) {
  if (typeof window === 'undefined') return () => {}
  const onChange = () => notify()
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) notify()
  }
  window.addEventListener(EVENT_NAME, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT_NAME, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

export function usePublicBundle() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggle = useCallback((id: string) => {
    const current = readBundle()
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id]
    writeBundle(next)
  }, [])

  const clear = useCallback(() => writeBundle([]), [])

  const has = useCallback((id: string) => ids.includes(id), [ids])

  // Hydration signal — server snapshot is always EMPTY (frozen sentinel);
  // any other reference means we're on the client and read real state.
  const hydrated = ids !== EMPTY || cacheVersion > 0

  // Memoise the array reference for downstream `.map(...)` consumers.
  const arr = useMemo(() => [...ids], [ids])

  return { ids: arr, has, toggle, clear, hydrated }
}
