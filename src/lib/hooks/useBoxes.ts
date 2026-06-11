'use client'

import type { Box, BoxItem } from '@/types'
import { useLiveTable, type UseLiveTableReturn } from '@/lib/hooks/useLiveTable'

export type BoxWithItems = Box & { items: BoxItem[] }

async function fetchBoxes(): Promise<BoxWithItems[]> {
  const res = await fetch('/api/boxes')
  if (!res.ok) throw new Error(`Failed to fetch boxes (${res.status})`)
  const data = (await res.json()) as BoxWithItems[]
  return Array.isArray(data) ? data.map((b) => ({ ...b, items: b.items ?? [] })) : []
}

interface UseBoxesOptions {
  /** Scopes the realtime channel; RLS scopes delivery either way. */
  profileId?: string | undefined
  /** Server-rendered seed — skips the initial fetch. */
  initial?: BoxWithItems[] | undefined
  enabled?: boolean | undefined
}

/**
 * Live box list (each box carries its box_items, as /api/boxes returns).
 * box_item changes trigger a debounced refetch so the embedded items stay
 * current; box-row changes merge in place via realtime.
 */
export function useBoxes(options?: UseBoxesOptions): UseLiveTableReturn<BoxWithItems> {
  return useLiveTable<BoxWithItems>({
    table: 'box',
    filter: options?.profileId ? `user_profile_id=eq.${options.profileId}` : undefined,
    fetcher: fetchBoxes,
    initial: options?.initial,
    refetchOnTables: ['box_item'],
    enabled: options?.enabled,
  })
}
