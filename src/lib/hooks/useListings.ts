'use client'

import type { OwnerListing } from '@/mcp/listings'
import { useLiveTable, type UseLiveTableReturn } from '@/lib/hooks/useLiveTable'

async function fetchListings(): Promise<OwnerListing[]> {
  const res = await fetch('/api/listings')
  if (!res.ok) throw new Error(`Failed to fetch listings (${res.status})`)
  const data = (await res.json()) as OwnerListing[]
  return Array.isArray(data) ? data.map((l) => ({ ...l, item_assessment: l.item_assessment ?? null })) : []
}

const newestFirst = (a: OwnerListing, b: OwnerListing) =>
  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()

interface UseListingsOptions {
  profileId?: string | undefined
  initial?: OwnerListing[] | undefined
  enabled?: boolean | undefined
}

/**
 * Live owner listings (with the joined item_assessment card fields, as
 * /api/listings returns). Listing-row changes merge in place; a brand-new
 * listing arriving via realtime triggers a refetch to pick up the join.
 */
export function useListings(options?: UseListingsOptions): UseLiveTableReturn<OwnerListing> {
  return useLiveTable<OwnerListing>({
    table: 'listing',
    filter: options?.profileId ? `user_profile_id=eq.${options.profileId}` : undefined,
    fetcher: fetchListings,
    initial: options?.initial,
    sort: newestFirst,
    enabled: options?.enabled,
  })
}
