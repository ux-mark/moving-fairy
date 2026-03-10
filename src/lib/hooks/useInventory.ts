'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Box, BoxItem, ItemAssessment } from '@/types'
import type { CostSummaryData } from '@/components/inventory/CostSummary'

export type { CostSummaryData }

interface InventoryState {
  assessments: ItemAssessment[]
  boxes: Box[]
  boxItems: Record<string, BoxItem[]>
  costSummary: CostSummaryData
  isLoading: boolean
  error: string | null
}

const EMPTY_COST: CostSummaryData = {
  counts_by_verdict: {},
  total_estimated_ship_cost: 0,
  currency: 'EUR',
}

export function useInventory() {
  const [state, setState] = useState<InventoryState>({
    assessments: [],
    boxes: [],
    boxItems: {},
    costSummary: EMPTY_COST,
    isLoading: true,
    error: null,
  })

  const fetchInventory = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const [assessRes, boxesRes, costRes] = await Promise.allSettled([
        fetch('/api/assessments'),
        fetch('/api/boxes'),
        fetch('/api/cost-summary'),
      ])

      let assessments: ItemAssessment[] = []
      let boxes: Box[] = []
      let boxItems: Record<string, BoxItem[]> = {}
      let costSummary: CostSummaryData = EMPTY_COST

      if (assessRes.status === 'fulfilled' && assessRes.value.ok) {
        const data = (await assessRes.value.json()) as ItemAssessment[] | { assessments: ItemAssessment[] }
        assessments = Array.isArray(data) ? data : (data.assessments ?? [])
      }

      if (boxesRes.status === 'fulfilled' && boxesRes.value.ok) {
        const data = (await boxesRes.value.json()) as Array<Box & { items: BoxItem[] }>
        boxes = data.map(({ items, ...box }) => { void items; return box as Box })
        boxItems = Object.fromEntries(data.map((b) => [b.id, b.items ?? []]))
      }

      if (costRes.status === 'fulfilled' && costRes.value.ok) {
        costSummary = (await costRes.value.json()) as CostSummaryData
      } else {
        costSummary = deriveCostSummary(assessments)
      }

      setState({
        assessments,
        boxes,
        boxItems,
        costSummary,
        isLoading: false,
        error: null,
      })
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load inventory',
      }))
    }
  }, [])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  return { ...state, refreshInventory: fetchInventory }
}

function deriveCostSummary(assessments: ItemAssessment[]): CostSummaryData {
  const counts_by_verdict: Record<string, number> = {}
  let totalShipCost = 0

  for (const a of assessments) {
    counts_by_verdict[a.verdict] = (counts_by_verdict[a.verdict] ?? 0) + 1
    if (a.verdict === 'SHIP' && a.estimated_ship_cost !== null) {
      totalShipCost += a.estimated_ship_cost
    }
  }

  return {
    counts_by_verdict,
    total_estimated_ship_cost: Math.round(totalShipCost),
    currency: 'EUR',
  }
}
