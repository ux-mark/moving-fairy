'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { ItemAssessment } from '@/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface UseItemsReturn {
  items: ItemAssessment[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  addItemByPhoto: (imageUrl: string) => Promise<ItemAssessment>
  addItemByText: (itemName: string) => Promise<ItemAssessment>
  confirmItem: (id: string) => Promise<void>
  retryAssessment: (id: string) => Promise<void>
  updateVerdict: (id: string, verdict: string) => Promise<void>
}

export function useItems(profileId?: string): UseItemsReturn {
  const [items, setItems] = useState<ItemAssessment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const isMountedRef = useRef(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const refresh = useCallback(async () => {
    if (!isMountedRef.current) return
    try {
      const res = await fetch('/api/items')
      if (!res.ok) throw new Error(`Failed to fetch items (${res.status})`)
      const data = (await res.json()) as { items?: ItemAssessment[] } | ItemAssessment[]
      const fetched: ItemAssessment[] = Array.isArray(data)
        ? data
        : (data.items ?? [])
      if (isMountedRef.current) {
        // Sort oldest first so the first item uploaded appears at the top
        setItems([...fetched].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()))
        setError(null)
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load items')
      }
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true
    setIsLoading(true)
    refresh().finally(() => {
      if (isMountedRef.current) setIsLoading(false)
    })

    return () => {
      isMountedRef.current = false
    }
  }, [refresh])

  // Polling fallback: refresh every 5s while any item is pending/processing.
  // This is a safety net in case Realtime misses UPDATE events.
  useEffect(() => {
    const hasPending = items.some(
      (i) => i.processing_status === 'pending' || i.processing_status === 'processing'
    )
    if (!hasPending) return

    const id = setInterval(() => {
      if (isMountedRef.current) refresh()
    }, 5_000)

    return () => clearInterval(id)
  }, [items, refresh])

  // Refresh when the tab regains focus (covers missed Realtime events)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isMountedRef.current) {
        refresh()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [refresh])

  // Supabase Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('item_assessment_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'item_assessment',
          ...(profileId ? { filter: `user_profile_id=eq.${profileId}` } : {}),
        },
        (payload) => {
          if (!isMountedRef.current) return
          if (payload.eventType === 'INSERT') {
            const newItem = payload.new as ItemAssessment
            setItems((prev) => {
              // If already exists (optimistic add), replace it
              const exists = prev.some((i) => i.id === newItem.id)
              if (exists) {
                return prev.map((i) => (i.id === newItem.id ? newItem : i))
              }
              // Append (oldest first order)
              return [...prev, newItem]
            })
          } else if (payload.eventType === 'UPDATE') {
            const updatedItem = payload.new as ItemAssessment
            setItems((prev) =>
              prev.map((i) => (i.id === updatedItem.id ? updatedItem : i))
            )
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id
            setItems((prev) => prev.filter((i) => i.id !== deletedId))
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase client is stable; profileId intentionally omitted to avoid re-subscribing mid-session
  }, [profileId])

  const addItemByPhoto = useCallback(async (imageUrl: string): Promise<ItemAssessment> => {
    // Create the item record
    const createRes = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, source: 'photo_upload' }),
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

    // Trigger background assessment (fire and forget — Realtime will update when done)
    fetch(`/api/assess/${item.id}`, { method: 'POST' }).catch(console.error)

    return item
  }, [])

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
  }, [])

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
  }, [])

  const retryAssessment = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/assess/${id}`, { method: 'POST' })
    if (!res.ok) {
      throw new Error(`Failed to retry assessment (${res.status})`)
    }
    // Optimistically set to pending while it processes
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, processing_status: 'pending' } : i))
    )
  }, [])

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
      // Roll back optimistic update on failure
      setItems((prev) =>
        prev.map((i) => {
          if (i.id !== id) return i
          // We don't have the old value anymore, so refresh from server
          return i
        })
      )
      throw new Error(`Failed to update verdict (${res.status})`)
    }
    // Realtime will deliver the confirmed update; nothing more needed here
  }, [])

  return {
    items,
    isLoading,
    error,
    refresh,
    addItemByPhoto,
    addItemByText,
    confirmItem,
    retryAssessment,
    updateVerdict,
  }
}
