"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Box, BoxItem, ItemAssessment } from "@/types";
import type { CostSummaryData } from "@/components/inventory/CostSummary";

// Module-level registry so external callers (e.g. ChatInterface after AI tool
// calls) can trigger a refresh of all mounted useInventory instances.
let externalRefreshCallbacks: Array<() => void> = [];

export function registerInventoryRefresh(cb: () => void): () => void {
  externalRefreshCallbacks.push(cb);
  return () => {
    externalRefreshCallbacks = externalRefreshCallbacks.filter((fn) => fn !== cb);
  };
}

export function triggerInventoryRefresh() {
  externalRefreshCallbacks.forEach((cb) => cb());
}

// Re-export so consumers can import CostSummaryData from one place.
export type { CostSummaryData };

interface InventoryState {
  assessments: ItemAssessment[];
  boxes: Box[];
  boxItems: Record<string, BoxItem[]>;
  costSummary: CostSummaryData;
  isLoading: boolean;
  error: string | null;
}

const EMPTY_COST: CostSummaryData = {
  counts_by_verdict: {},
  total_estimated_ship_cost: 0,
  currency: "EUR",
};

export function useInventory() {
  const [state, setState] = useState<InventoryState>({
    assessments: [],
    boxes: [],
    boxItems: {},
    costSummary: EMPTY_COST,
    isLoading: true,
    error: null,
  });

  const hasLoadedRef = useRef(false);

  const fetchInventory = useCallback(async () => {
    // Only show skeleton on initial load, not background refreshes
    if (!hasLoadedRef.current) {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
    }

    try {
      const [assessRes, boxesRes, costRes] = await Promise.allSettled([
        fetch("/api/assessments"),
        fetch("/api/boxes"),
        fetch("/api/cost-summary"),
      ]);

      let assessments: ItemAssessment[] = [];
      let boxes: Box[] = [];
      let boxItems: Record<string, BoxItem[]> = {};
      let costSummary: CostSummaryData = EMPTY_COST;

      if (assessRes.status === "fulfilled" && assessRes.value.ok) {
        const data = await assessRes.value.json();
        assessments = data.assessments ?? data ?? [];
      }

      if (boxesRes.status === "fulfilled" && boxesRes.value.ok) {
        const data = await boxesRes.value.json();
        const rawBoxes = data.boxes ?? data ?? [];
        boxes = rawBoxes.map(({ items, ...box }: { items?: unknown; [key: string]: unknown }) => box);
        boxItems = Object.fromEntries(
          rawBoxes.map((b: { id: string; items?: unknown[] }) => [b.id, b.items ?? []])
        );
      }

      if (costRes.status === "fulfilled" && costRes.value.ok) {
        const data = await costRes.value.json();
        costSummary = data.summary ?? data ?? EMPTY_COST;
      } else {
        // Derive cost summary from assessments if endpoint not available
        costSummary = deriveCostSummary(assessments);
      }

      hasLoadedRef.current = true;
      setState({
        assessments,
        boxes,
        boxItems,
        costSummary,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to load inventory",
      }));
    }
  }, []);

  useEffect(() => {
    fetchInventory();

    // Register with the global refresh system so external triggers
    // (e.g. ChatInterface after AI tool calls) refresh this hook too.
    const unregister = registerInventoryRefresh(fetchInventory);
    return () => {
      unregister();
    };
  }, [fetchInventory]);

  return { ...state, refreshInventory: fetchInventory };
}

function deriveCostSummary(assessments: ItemAssessment[]): CostSummaryData {
  const counts_by_verdict: Record<string, number> = {};
  let totalShipCost = 0;

  for (const a of assessments) {
    if (a.verdict) {
      counts_by_verdict[a.verdict] = (counts_by_verdict[a.verdict] ?? 0) + 1;
    }
    if (a.verdict === "SHIP" && a.estimated_ship_cost !== null) {
      totalShipCost += a.estimated_ship_cost;
    }
  }

  return {
    counts_by_verdict,
    total_estimated_ship_cost: Math.round(totalShipCost),
    currency: "EUR",
  };
}
