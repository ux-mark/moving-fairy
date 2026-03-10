'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Box, BoxItem, ItemAssessment } from '@/types'

export interface CostSummaryData {
  counts_by_verdict: Record<string, number>
  total_estimated_ship_cost: number
  currency: string
}

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

const INITIAL_STATE: InventoryData = {
  assessments: [],
  boxes: [],
  costSummary: null,
  isLoading: true,
  error: null,
}

// Module-level ref to allow the chat interface to trigger a refresh externally
let externalRefreshCallbacks: Array<() => void> = []

export function registerInventoryRefresh(cb: () => void): () => void {
  externalRefreshCallbacks.push(cb)
  return () => {
    externalRefreshCallbacks = externalRefreshCallbacks.filter((fn) => fn !== cb)
  }
}

export function triggerInventoryRefresh() {
  externalRefreshCallbacks.forEach((cb) => cb())
}

export function useInventoryData() {
  const [state, setState] = useState<InventoryData>(INITIAL_STATE)
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
        assessments = await assessRes.value.json()
      }

      if (boxesRes.status === 'fulfilled' && boxesRes.value.ok) {
        boxes = await boxesRes.value.json()
      }

      if (costRes.status === 'fulfilled' && costRes.value.ok) {
        costSummary = await costRes.value.json()
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
