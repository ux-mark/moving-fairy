'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { ItemAssessment } from '@/types'
import { useLiveTable } from '@/lib/hooks/useLiveTable'

interface UseItemsReturn {
  items: ItemAssessment[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  addItemByText: (itemName: string) => Promise<ItemAssessment>
  confirmItem: (id: string) => Promise<void>
  retryAssessment: (id: string) => Promise<void>
  updateVerdict: (id: string, verdict: string) => Promise<void>
}

// Concurrent fetches share one request — several useItems instances (page +
// open panels) revalidating on the same focus event fire a single GET.
let itemsFetchInflight: Promise<ItemAssessment[]> | null = null

function fetchItems(): Promise<ItemAssessment[]> {
  itemsFetchInflight ??= (async () => {
    try {
      const res = await fetch('/api/items')
      if (!res.ok) throw new Error(`Failed to fetch items (${res.status})`)
      const data = (await res.json()) as { items?: ItemAssessment[] } | ItemAssessment[]
      return Array.isArray(data) ? data : (data.items ?? [])
    } finally {
      itemsFetchInflight = null
    }
  })()
  return itemsFetchInflight
}

// Sort oldest first so the first item uploaded appears at the top.
const oldestFirst = (a: ItemAssessment, b: ItemAssessment) =>
  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()

// Stuck-item recovery thresholds. Assessment runs as in-process background
// work on the server, so a crash mid-flight orphans items. There is no
// blanket polling any more — recovery checks run locally on a timer only
// while pending/processing items exist, and refetch once before firing.
const STUCK_PENDING_MS = 15_000 // the auto-trigger fires ~1s after upload
const STUCK_PROCESSING_MS = 180_000 // 3min failsafe for a dead server
const RECOVERY_CHECK_INTERVAL_MS = 30_000
const RECOVERY_BACKOFF_BASE_MS = 180_000 // 3min, doubles per attempt

interface RecoveryAttempt {
  attempts: number
  lastAt: number
}

function findStuckItem(
  items: ItemAssessment[],
  attempts: Map<string, RecoveryAttempt>,
  now: number
): { item: ItemAssessment; force: boolean } | null {
  // If any item is *actively* processing (recently touched), wait — a Claude
  // CLI subprocess is running on the server and the dev container OOMs at
  // modest concurrency. Items stuck from an old crash don't count.
  const anyActiveProcessing = items.some((i) => {
    if (i.processing_status !== 'processing') return false
    return now - new Date(i.updated_at ?? i.created_at).getTime() < STUCK_PROCESSING_MS
  })
  if (anyActiveProcessing) return null

  for (const item of items) {
    const age = now - new Date(item.updated_at ?? item.created_at).getTime()
    const isStuckPending = item.processing_status === 'pending' && age > STUCK_PENDING_MS
    const isStuckProcessing =
      item.processing_status === 'processing' && age > STUCK_PROCESSING_MS
    if (!isStuckPending && !isStuckProcessing) continue

    // Exponential backoff per item: 3min, 6min, 12min… between attempts.
    const prior = attempts.get(item.id)
    if (prior && now - prior.lastAt < RECOVERY_BACKOFF_BASE_MS * 2 ** (prior.attempts - 1)) {
      continue
    }
    return { item, force: isStuckProcessing }
  }
  return null
}

export function useItems(profileId?: string): UseItemsReturn {
  const {
    rows: items,
    setRows: setItems,
    isLoading,
    error,
    refresh: refreshRows,
  } = useLiveTable<ItemAssessment>({
    table: 'item_assessment',
    filter: profileId ? `user_profile_id=eq.${profileId}` : undefined,
    fetcher: fetchItems,
    sort: oldestFirst,
  })

  const refresh = useCallback(async () => {
    await refreshRows()
  }, [refreshRows])

  // Targeted stuck-item recovery. Runs only while pending/processing items
  // exist; confirms staleness with one refetch before re-firing /api/assess
  // (idempotent), strictly one item at a time.
  const itemsRef = useRef(items)
  itemsRef.current = items
  const recoveryAttemptsRef = useRef<Map<string, RecoveryAttempt>>(new Map())
  const recoveryInFlightRef = useRef(false)

  const runRecoveryCheck = useCallback(async () => {
    if (recoveryInFlightRef.current) return
    const attempts = recoveryAttemptsRef.current
    if (!findStuckItem(itemsRef.current, attempts, Date.now())) return

    recoveryInFlightRef.current = true
    try {
      // Confirm against the server before re-firing — a missed realtime event
      // may mean the item already completed.
      const fresh = await refreshRows()
      if (!fresh) return
      const candidate = findStuckItem(fresh, attempts, Date.now())
      if (!candidate) return

      const { item, force } = candidate
      const prior = attempts.get(item.id)
      attempts.set(item.id, { attempts: (prior?.attempts ?? 0) + 1, lastAt: Date.now() })
      const url = force ? `/api/assess/${item.id}?force=true` : `/api/assess/${item.id}`
      await fetch(url, { method: 'POST' }).catch((err) => {
        console.error('Failed to recover stuck item', item.id, err)
      })
    } finally {
      recoveryInFlightRef.current = false
    }
  }, [refreshRows])

  useEffect(() => {
    const hasInFlight = items.some(
      (i) => i.processing_status === 'pending' || i.processing_status === 'processing'
    )
    if (!hasInFlight) return
    const id = setInterval(() => void runRecoveryCheck(), RECOVERY_CHECK_INTERVAL_MS)
    void runRecoveryCheck()
    return () => clearInterval(id)
  }, [items, runRecoveryCheck])

  // Photo-sourced items are created by the background upload queue
  // (src/components/upload) so creation works away from this page;
  // Realtime INSERT events land them in this list.

  const addItemByText = useCallback(async (itemName: string): Promise<ItemAssessment> => {
    const createRes = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_name: itemName, source: 'text_add' }),
    })
    if (!createRes.ok) {
      throw new Error(`Failed to create item (${createRes.status})`)
    }
    const data = (await createRes.json()) as { item?: ItemAssessment } | ItemAssessment
    const item: ItemAssessment = 'item' in data && data.item ? data.item : (data as ItemAssessment)

    // Optimistically add the pending item (append — oldest first order)
    setItems((prev) => {
      const exists = prev.some((i) => i.id === item.id)
      if (exists) return prev
      return [...prev, item]
    })

    // Trigger background assessment
    fetch(`/api/assess/${item.id}`, { method: 'POST' }).catch(console.error)

    return item
  }, [setItems])

  const confirmItem = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_confirmed: true }),
    })
    if (!res.ok) {
      throw new Error(`Failed to confirm item (${res.status})`)
    }
    // Realtime will update the item; do an optimistic update as well
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, user_confirmed: true } : i))
    )
  }, [setItems])

  const retryAssessment = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/assess/${id}`, { method: 'POST' })
    if (!res.ok) {
      throw new Error(`Failed to retry assessment (${res.status})`)
    }
    // Optimistically set to pending while it processes
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, processing_status: 'pending' } : i))
    )
  }, [setItems])

  const updateVerdict = useCallback(async (id: string, verdict: string): Promise<void> => {
    // Optimistic update — apply immediately; Realtime will confirm
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, verdict: verdict as ItemAssessment['verdict'] } : i
      )
    )

    const res = await fetch(`/api/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verdict }),
    })
    if (!res.ok) {
      // Roll back to server truth on failure
      await refreshRows()
      throw new Error(`Failed to update verdict (${res.status})`)
    }
    // Realtime will deliver the confirmed update; nothing more needed here
  }, [setItems, refreshRows])

  return {
    items,
    isLoading,
    error,
    refresh,
    addItemByText,
    confirmItem,
    retryAssessment,
    updateVerdict,
  }
}
