'use client'

import type { Shipment } from '@/types/database'
import { useLiveTable, type UseLiveTableReturn } from '@/lib/hooks/useLiveTable'

async function fetchShipments(): Promise<Shipment[]> {
  const res = await fetch('/api/shipments')
  if (!res.ok) throw new Error(`Failed to fetch shipments (${res.status})`)
  const data = (await res.json()) as Shipment[]
  return Array.isArray(data) ? data : []
}

const byLegOrder = (a: Shipment, b: Shipment) => a.leg_order - b.leg_order

interface UseShipmentsOptions {
  profileId?: string | undefined
  initial?: Shipment[] | undefined
  enabled?: boolean | undefined
}

/** Live shipment legs, ordered by leg_order. */
export function useShipments(options?: UseShipmentsOptions): UseLiveTableReturn<Shipment> {
  return useLiveTable<Shipment>({
    table: 'shipment',
    filter: options?.profileId ? `user_profile_id=eq.${options.profileId}` : undefined,
    fetcher: fetchShipments,
    initial: options?.initial,
    sort: byLegOrder,
    enabled: options?.enabled,
  })
}
