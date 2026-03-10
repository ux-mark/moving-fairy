'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Box, BoxItem, ItemAssessment } from '@/types'
import type { CostSummaryData } from '@/components/inventory/CostSummary'

export type { CostSummaryData }

export interface BoxWithItems extends Box {
  items: BoxItem[]
}

interface InventoryData {
  assessments: ItemAssessment[]
  boxes: BoxWithItems[]
  costSummary: CostSummaryData | null
  isLoading: boolean
  error: string | null
}

// Module-level callbacks so the chat interface can trigger a refresh externally
let externalRefreshCallbacks: Array<() => void> = []

export function registerInventoryRefresh(cb: () => void): () => void {
  externalRefreshCallbacks.push(cb)
  return () => {
    externalRefreshCallbacks = externalRefreshCallbacks.filter((fn) => fn !== cb)
  }
}

export function triggerInventoryRefresh(): void {
  externalRefreshCallbacks.forEach((cb) => cb())
}

export function useInventoryData() {
  const [state, setState] = useState<InventoryData>({
    assessments: [],
    boxes: [],
    costSummary: null,
    isLoading: true,
    error: null,
  })
  const isMountedRef = useRef(true)

  const refresh = useCallback(async () => {
    if (!isMountedRef.current) return
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const [assessRes, boxesRes, costRes] = await Promise.allSettled([
        fetch('/api/assessments'),
        fetch('/api/boxes'),
        fetch('/api/cost-summary'),
      ])

      let assessments: ItemAssessment[] = []
      let boxes: BoxWithItems[] = []
      let costSummary: CostSummaryData | null = null

      if (assessRes.status === 'fulfilled' && assessRes.value.ok) {
        assessments = (await assessRes.value.json()) as ItemAssessment[]
      }

      if (boxesRes.status === 'fulfilled' && boxesRes.value.ok) {
        boxes = (await boxesRes.value.json()) as BoxWithItems[]
      }

      if (costRes.status === 'fulfilled' && costRes.value.ok) {
        costSummary = (await costRes.value.json()) as CostSummaryData
      }

      if (isMountedRef.current) {
        setState({ assessments, boxes, costSummary, isLoading: false, error: null })
      }
    } catch (err) {
      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to load inventory',
        }))
      }
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    refresh()

    const unregister = registerInventoryRefresh(refresh)
    return () => {
      isMountedRef.current = false
      unregister()
    }
  }, [refresh])

  return { ...state, refresh }
}
